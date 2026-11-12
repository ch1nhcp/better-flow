import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

interface SavedGraph {
  title: string;
  nodes: { position: { x: number; y: number } }[];
  edges: unknown[];
}

const user = { id: 1, email: 'playground@example.test', createdAt: '2026-11-01T00:00:00.000Z' };
const savedTitle = 'Lộ trình Web đã chỉnh tên';
const draft = [
  '# Lộ trình Web',
  'html -> css [animated] [type=default]',
  '## [html] HTML cơ bản',
  'Cấu trúc trang web.',
  '## [css] CSS cơ bản',
].join('\n');

async function expectCanvasPalette(graph: Locator) {
  await expect(graph).toHaveCSS('background-color', 'rgb(248, 250, 252)');
  await expect(graph.locator('.roadmap-step-handle').first()).toHaveCSS(
    'background-color',
    'rgb(37, 99, 235)',
  );
  const edge = graph.locator('.react-flow__edge-path').first();
  await expect(edge).toHaveCSS('stroke', 'rgb(148, 163, 184)');
  await expect(edge).toHaveAttribute('marker-end', /^url\(/);
  await expect(graph.locator('.react-flow__arrowhead .arrowclosed')).toHaveCSS(
    'fill',
    'rgb(37, 99, 235)',
  );
}

test('requires a session to open the Playground', async ({ page }) => {
  await page.goto('/playground');
  await expect(page).toHaveURL('/login');
});

test('previews Markdown, preserves the draft on errors, and opens the saved graph in Canvas', async ({
  page,
}, testInfo) => {
  const tokenPayload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const token = `fixture.${tokenPayload}.fixture`;
  await page.addInitScript((value) => localStorage.setItem('betterflow.authToken', value), token);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { data: { user } } }));

  let saved: SavedGraph | undefined;
  let attempts = 0;
  await page.route('**/api/roadmaps', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { data: { roadmaps: [] } } });
      return;
    }
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    const payload = route.request().postDataJSON() as SavedGraph;
    expect(payload).toMatchObject({
      title: savedTitle,
      nodes: [
        {
          id: 'html',
          type: 'default',
          data: { label: 'HTML cơ bản', description: 'Cấu trúc trang web.' },
        },
        { id: 'css', type: 'default', data: { label: 'CSS cơ bản' } },
      ],
      edges: [{ source: 'html', target: 'css', animated: true, type: 'default' }],
    });
    expect(payload.nodes[1]!.position.y).toBeGreaterThan(payload.nodes[0]!.position.y);
    if (++attempts === 1) {
      await route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Lưu thất bại. Vui lòng thử lại.' } },
      });
      return;
    }
    const roadmap = {
      ...payload,
      id: 25,
      userId: user.id,
      isPublic: false,
      shareCode: null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
    };
    saved = roadmap;
    await route.fulfill({ status: 201, json: { data: { roadmap } } });
  });
  await page.route('**/api/roadmaps/25', async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({ json: { data: { roadmap: saved } } });
  });

  await page.goto('/roadmaps');
  await page.getByRole('link', { name: 'Playground' }).click();
  await expect(page).toHaveURL('/playground');
  const preview = page.getByRole('region', { name: 'Xem trước sơ đồ' });
  const editor = page.getByRole('textbox', { name: 'Markdown' });
  const save = page.getByRole('button', { name: 'Lưu thành roadmap' });
  await expect(preview.getByText('Chuẩn bị môi trường', { exact: true })).toBeVisible();
  await expect(preview.getByText('Tự sắp xếp: Từ trên xuống')).toBeVisible();
  await expect(preview.locator('.react-flow__edge')).toHaveCount(4);
  await expectCanvasPalette(preview.locator('.roadmap-canvas'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('playground.png'), fullPage: true });

  await editor.fill(`${draft}\ncss -> missing`);
  await expect(save).toBeDisabled();
  await expect(page.getByText('Dòng 6, cột 1 · Chưa khai báo node "missing".')).toBeVisible();
  await expect(preview.getByText('Chuẩn bị môi trường', { exact: true })).toBeVisible();
  await expect(preview.getByRole('status')).toHaveText(
    'Đang hiển thị bản xem trước hợp lệ gần nhất.',
  );
  expect(attempts).toBe(0);

  await editor.fill(draft);
  await expect(preview.getByText('HTML cơ bản', { exact: true })).toBeVisible();
  await expect(preview.locator('.react-flow__edge')).toHaveCount(1);
  await save.click();
  const dialog = page.getByRole('dialog', { name: 'Lưu thành Roadmap' });
  const titleInput = dialog.getByRole('textbox', { name: 'Tên roadmap' });
  const confirmSave = dialog.getByRole('button', { name: 'Lưu và mở Canvas' });
  await expect(titleInput).toHaveValue('Lộ trình Web');
  await expect(titleInput).toBeFocused();
  await expect(dialog.getByText('2 bước', { exact: true })).toBeVisible();
  await expect(dialog.getByText('1 liên kết', { exact: true })).toBeVisible();
  expect(attempts).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath('playground-save-dialog.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(save).toBeFocused();
  expect(attempts).toBe(0);

  await save.click();
  await titleInput.fill('');
  await confirmSave.click();
  await expect(dialog.getByRole('alert')).toHaveText('Vui lòng nhập tên roadmap.');
  expect(attempts).toBe(0);
  await titleInput.fill(savedTitle);
  await confirmSave.click();
  await expect(dialog.getByRole('alert')).toHaveText('Lưu thất bại. Vui lòng thử lại.');
  await expect(titleInput).toHaveValue(savedTitle);
  await expect(editor).toHaveValue(draft);

  await confirmSave.click();
  await expect(page).toHaveURL('/roadmaps/25');
  await page.reload();
  await expect(page.getByLabel('Tên roadmap')).toHaveValue(savedTitle);
  const htmlNode = page.locator('.react-flow__node[data-id="html"]');
  await expect(htmlNode.getByText('Cấu trúc trang web.', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expectCanvasPalette(page.getByRole('region', { name: 'Canvas roadmap' }));
  await expect(htmlNode.locator('.roadmap-step-node')).toHaveCSS(
    'border-top-color',
    'rgb(37, 99, 235)',
  );
  const firstNode = saved!.nodes[0]!;
  await expect(htmlNode).toHaveCSS(
    'transform',
    `matrix(1, 0, 0, 1, ${firstNode.position.x}, ${firstNode.position.y})`,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('canvas.png'), fullPage: true });
  await page.getByRole('button', { name: 'Bỏ chọn' }).click();
  await expect(page.getByRole('textbox', { name: 'Tên bước' })).toHaveCount(0);
  await expect(htmlNode.locator('.roadmap-step-node')).toHaveCSS(
    'border-top-color',
    'rgb(226, 232, 240)',
  );
});
