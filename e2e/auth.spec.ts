import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const user = { id: 1, email: 'auth@example.test', createdAt: '2026-11-01T00:00:00.000Z' };
const password = 'test-password';
const storageKey = 'betterflow.authToken';
const sampleRoadmaps = [
  {
    id: 10,
    title: 'Onboarding Frontend',
    nodeCount: 5,
    previewNodes: [
      { id: 'n1', label: 'Chuẩn bị môi trường' },
      { id: 'n2', label: 'Nền tảng TypeScript' },
      { id: 'n3', label: 'React Cơ bản & Hooks' },
    ],
    isPublic: true,
    shareCode: 'fe2026',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-09T18:30:00.000Z',
  },
  {
    id: 11,
    title: 'Nền tảng Backend',
    nodeCount: 3,
    previewNodes: [
      { id: 'n1', label: 'HTTP & RESTful Protocol' },
      { id: 'n2', label: 'PostgreSQL & Database Design' },
    ],
    isPublic: false,
    shareCode: null,
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-08T15:20:00.000Z',
  },
  {
    id: 12,
    title: 'Lộ trình thực tập sinh',
    nodeCount: 3,
    previewNodes: [{ id: 'n1', label: 'Tuần 1-2: Hội nhập' }],
    isPublic: false,
    shareCode: null,
    createdAt: '2026-11-03T08:00:00.000Z',
    updatedAt: '2026-11-07T10:00:00.000Z',
  },
];

function tokenFor(expiresAt: number) {
  return `fixture.${Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url')}.fixture`;
}

async function mockCurrentUser(page: Page, token: string) {
  await page.route('**/api/auth/me', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({ json: { data: { user } } });
  });
}

async function mockRoadmaps(page: Page, token: string, roadmaps = sampleRoadmaps) {
  await page.route('**/api/roadmaps', async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({ json: { data: { roadmaps } } });
  });
}

test('registers, restores the verified workspace after reload and logs out', async ({
  page,
}, testInfo) => {
  const token = tokenFor(Math.floor(Date.now() / 1000) + 3600);
  await page.route('**/api/auth/register', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ email: user.email, password });
    await route.fulfill({ status: 201, json: { data: { token, user } } });
  });
  await mockCurrentUser(page, token);
  await mockRoadmaps(page, token);

  await page.goto('/roadmaps');
  await expect(page).toHaveURL('/login');
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Đăng ký ngay' }).click();
  await expect(page).toHaveURL('/register');
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('register.png'), fullPage: true });
  await page.getByLabel('Email', { exact: true }).fill(user.email.toUpperCase());
  await page.getByLabel('Mật khẩu', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('alert')).toHaveText('Mật khẩu cần ít nhất 8 ký tự.');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page).toHaveURL('/roadmaps');
  await expect(page.getByRole('heading', { name: 'Roadmap của tôi' })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('complementary').getByText(user.email, { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('handles invalid credentials and accepts a subsequent login', async ({ page }) => {
  const token = tokenFor(Math.floor(Date.now() / 1000) + 3600);
  await page.route('**/api/auth/login', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    if (route.request().postDataJSON().password === password) {
      await route.fulfill({ json: { data: { token, user } } });
    } else {
      await route.fulfill({
        status: 401,
        json: {
          error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không chính xác' },
        },
      });
    }
  });
  await mockCurrentUser(page, token);
  await mockRoadmaps(page, token);

  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không chính xác');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/roadmaps');
  await expect(
    page.getByRole('complementary').getByText(user.email, { exact: true }),
  ).toBeVisible();
});

test('returns to login when the server rejects the session', async ({ page }) => {
  const token = tokenFor(Math.floor(Date.now() / 1000) + 3600);
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    }),
  );
  await page.goto('/login');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: token,
  });
  await page.goto('/roadmaps');
  await expect(page).toHaveURL('/login');
  await expect(page.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('ends a session at JWT expiry without waiting for another request', async ({ page }) => {
  const now = new Date();
  const token = tokenFor(Math.floor(now.getTime() / 1000) + 120);
  await page.clock.install({ time: now });
  await mockCurrentUser(page, token);
  await mockRoadmaps(page, token);
  await page.goto('/login');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: token,
  });
  await page.goto('/roadmaps');
  await expect(page.getByRole('heading', { name: 'Roadmap của tôi' })).toBeVisible();
  await page.clock.fastForward(121_000);
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('displays and sorts user roadmaps from GET /api/roadmaps', async ({ page }, testInfo) => {
  const token = tokenFor(Math.floor(Date.now() / 1000) + 3600);
  let roadmaps = [...sampleRoadmaps];
  await mockCurrentUser(page, token);
  await page.route('**/api/roadmaps', async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({ json: { data: { roadmaps } } });
  });
  await page.route('**/api/roadmaps/10', async (route) => {
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    roadmaps = roadmaps.filter((item) => item.id !== 10);
    await route.fulfill({ json: { data: { message: 'Đã xóa roadmap thành công' } } });
  });
  await page.goto('/login');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: token,
  });

  await page.goto('/roadmaps');
  const heading = page.getByRole('heading', { name: 'Roadmap của tôi' });
  await expect(heading).toHaveCSS('font-family', /Segoe UI/);
  await expect(heading).toHaveCSS('font-weight', '700');
  await expect(page.getByRole('button', { name: 'Tạo roadmap' })).toBeEnabled();
  const headings = page.getByRole('list', { name: 'Danh sách roadmap' }).getByRole('heading');
  await expect(headings).toHaveText([
    'Onboarding Frontend',
    'Nền tảng Backend',
    'Lộ trình thực tập sinh',
  ]);
  await page.getByLabel('Sắp xếp').selectOption('name');
  await expect(headings).toHaveText([
    'Lộ trình thực tập sinh',
    'Nền tảng Backend',
    'Onboarding Frontend',
  ]);
  await page.getByRole('button', { name: 'Tùy chọn cho Onboarding Frontend' }).click();
  await expect(page.getByRole('button', { name: 'Chi tiết' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xóa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xóa', exact: true })).toBeHidden();
  const deleteDialog = page.getByRole('dialog', { name: 'Xóa roadmap?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(headings).toHaveText([
    'Lộ trình thực tập sinh',
    'Nền tảng Backend',
    'Onboarding Frontend',
  ]);

  await page.getByRole('button', { name: 'Tùy chọn cho Onboarding Frontend' }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Xóa roadmap' }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(headings).toHaveText(['Lộ trình thực tập sinh', 'Nền tảng Backend']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
});

test('creates a roadmap on /roadmaps/new and edits an existing roadmap on /roadmaps/:id', async ({
  page,
}) => {
  const token = tokenFor(Math.floor(Date.now() / 1000) + 3600);
  const existingRoadmap = {
    id: 10,
    userId: 1,
    title: 'Onboarding Frontend',
    nodes: [
      {
        id: 'node-1',
        type: 'default',
        position: { x: 100, y: 50 },
        data: { label: '01 Chuẩn bị môi trường', description: 'Cài Git và Node.js' },
      },
      {
        id: 'node-2',
        type: 'default',
        position: { x: 100, y: 200 },
        data: { label: '02 TypeScript' },
      },
    ],
    edges: [
      {
        id: 'edge-node-1-node-2',
        source: 'node-1',
        target: 'node-2',
        type: 'smoothstep',
        animated: false,
      },
    ],
    isPublic: false,
    shareCode: null,
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-09T18:30:00.000Z',
  };

  await mockCurrentUser(page, token);
  await mockRoadmaps(page, token);
  await page.route('**/api/roadmaps', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        title: 'Lộ trình React',
        nodes: [
          {
            id: 'node-1',
            type: 'default',
            position: { x: 240, y: 120 },
            data: { label: 'Nền tảng TypeScript', description: 'Kiểu dữ liệu và hàm' },
          },
        ],
        edges: [],
      });
      await route.fulfill({
        status: 201,
        json: {
          data: {
            roadmap: {
              ...existingRoadmap,
              id: 25,
              title: body.title,
              nodes: body.nodes,
              edges: body.edges,
            },
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { data: { roadmaps: sampleRoadmaps } } });
  });

  await page.route('**/api/roadmaps/10', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ json: { data: { roadmap: existingRoadmap } } });
      return;
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ title: 'Onboarding Frontend v2' });
      await route.fulfill({
        json: {
          data: {
            roadmap: {
              ...existingRoadmap,
              title: body.title,
            },
          },
        },
      });
    }
  });

  await page.goto('/login');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: token,
  });

  await page.goto('/roadmaps');
  await page.getByRole('button', { name: 'Tạo roadmap' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Tạo roadmap' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Vui lòng nhập tên roadmap.');

  await dialog.getByLabel('Tên roadmap').fill('Lộ trình React');
  await dialog.getByRole('button', { name: 'Tạo roadmap' }).click();

  await expect(page).toHaveURL('/roadmaps/new');
  await expect(page.getByLabel('Tên roadmap')).toHaveValue('Lộ trình React');
  await expect(page.getByText('Có thay đổi chưa lưu', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Tải xuống' }).click();
  const downloadDialog = page.getByRole('dialog', { name: 'Tải xuống' });
  await expect(downloadDialog.getByText('Lưu roadmap để tải xuống.')).toBeVisible();
  await expect(downloadDialog.getByRole('button', { name: 'Ảnh PNG' })).toBeDisabled();
  await expect(downloadDialog.getByRole('button', { name: 'Markdown (.md)' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(downloadDialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Thêm bước' }).click();
  await page.getByLabel('Tên bước').fill('Nền tảng TypeScript');
  await page.getByLabel('Mô tả (không bắt buộc)').fill('Kiểu dữ liệu và hàm');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await page.getByRole('button', { name: 'Lưu' }).click();

  await expect(page).toHaveURL('/roadmaps/25');
  await expect(page.getByText('Đã lưu')).toBeVisible();

  await page.getByRole('link', { name: 'Quay lại danh sách roadmap' }).click();
  await expect(page).toHaveURL('/roadmaps');
  const firstCard = page
    .getByRole('list', { name: 'Danh sách roadmap' })
    .locator('li.roadmap-card')
    .first();
  await expect(firstCard).toHaveCSS('cursor', 'pointer');
  const cardBox = await firstCard.boundingBox();
  expect(cardBox).not.toBeNull();
  await page.mouse.click(cardBox!.x + 30, cardBox!.y + 30);

  await expect(page).toHaveURL('/roadmaps/10');
  await expect(page.getByLabel('Tên roadmap')).toHaveValue('Onboarding Frontend');
  await expect(page.getByText('Đã lưu')).toBeVisible();

  await page.getByRole('button', { name: 'Chia sẻ' }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Chia sẻ roadmap' });
  await expect(shareDialog).toBeVisible();
  await shareDialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(shareDialog).toBeHidden();

  await page.getByLabel('Tên roadmap').fill('Onboarding Frontend v2');
  await expect(page.getByText('Có thay đổi chưa lưu', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Quay lại danh sách roadmap' }).click();
  const leaveDialog = page.getByRole('dialog');
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole('button', { name: 'Ở lại trang' }).click();
  await expect(page).toHaveURL('/roadmaps/10');

  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();
  await page.getByRole('link', { name: 'Quay lại danh sách roadmap' }).click();
  await expect(page).toHaveURL('/roadmaps');
});

test('downloads PNG and Markdown from Canvas and can retry a failed export', async ({
  page,
}, testInfo) => {
  const token = tokenFor(Math.floor(Date.now() / 1000) + 3600);
  const title = 'Lộ trình Frontend';
  const markdown = `# ${title}\n`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zx8AAAAASUVORK5CYII=',
    'base64',
  );
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: token,
  });
  await mockCurrentUser(page, token);
  await page.route('**/api/roadmaps/10', (route) =>
    route.fulfill({
      json: {
        data: {
          roadmap: { ...sampleRoadmaps[0], title, userId: user.id, nodes: [], edges: [] },
        },
      },
    }),
  );

  let pngAttempts = 0;
  let releaseFirstPng: (() => void) | undefined;
  const firstPngPending = new Promise<void>((resolve) => {
    releaseFirstPng = resolve;
  });
  await page.route('**/api/roadmaps/10/export?format=*', async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    const format = new URL(route.request().url()).searchParams.get('format');
    if (format === 'png') {
      if (++pngAttempts === 1) {
        await firstPngPending;
        await route.fulfill({
          status: 500,
          json: { error: { code: 'INTERNAL_ERROR', message: 'Không thể tạo ảnh PNG.' } },
        });
        return;
      }
      await route.fulfill({
        contentType: 'image/png',
        headers: {
          'Content-Disposition': `attachment; filename="Frontend.png"; filename*=UTF-8''${encodeURIComponent(title)}.png`,
        },
        body: png,
      });
      return;
    }
    expect(format).toBe('markdown');
    await route.fulfill({
      contentType: 'text/markdown; charset=utf-8',
      headers: { 'Content-Disposition': 'attachment; filename="Frontend.md"' },
      body: markdown,
    });
  });

  await page.goto('/roadmaps/10');
  const trigger = page.getByRole('button', { name: 'Tải xuống' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Tải xuống' });
  const pngButton = dialog.getByRole('button', { name: 'Ảnh PNG' });
  const markdownButton = dialog.getByRole('button', { name: 'Markdown (.md)' });
  await expect(pngButton).toBeVisible();
  await expect(markdownButton).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('download-dialog.png') });

  await pngButton.click();
  try {
    await expect(pngButton).toBeDisabled();
    await expect(pngButton).toHaveCSS('cursor', 'progress', { timeout: 1500 });
    await expect(pngButton).toHaveAttribute('aria-busy', 'true');
    await expect(markdownButton).toBeDisabled();
    await expect(dialog.getByRole('status')).toHaveText('Đang chuẩn bị ảnh PNG…');
    await page.screenshot({ path: testInfo.outputPath('download-loading.png') });
  } finally {
    releaseFirstPng?.();
  }
  await expect(dialog.getByRole('alert')).toHaveText('Không thể tạo ảnh PNG.');
  const [pngDownload] = await Promise.all([page.waitForEvent('download'), pngButton.click()]);
  expect(pngDownload.suggestedFilename()).toBe(`${title}.png`);
  expect(await readFile(await pngDownload.path())).toEqual(png);

  const [markdownDownload] = await Promise.all([
    page.waitForEvent('download'),
    markdownButton.click(),
  ]);
  expect(markdownDownload.suggestedFilename()).toBe('Frontend.md');
  expect(await readFile(await markdownDownload.path(), 'utf8')).toBe(markdown);
  await expect(dialog.getByRole('status')).toHaveText('Đã bắt đầu tải file.');

  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(trigger).toBeFocused();
  await page.getByLabel('Tên roadmap').fill('Tên đang chỉnh sửa');
  await trigger.click();
  await expect(dialog.getByText('File dùng bản roadmap đã lưu gần nhất.')).toBeVisible();
  await expect(pngButton).toBeEnabled();
});
