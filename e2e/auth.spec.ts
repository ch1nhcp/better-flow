import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const user = { id: 1, email: 'auth@example.test', createdAt: '2026-11-01T00:00:00.000Z' };
const password = 'test-password';
const storageKey = 'betterflow.authToken';

function tokenFor(expiresAt: number) {
  return `fixture.${Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url')}.fixture`;
}

async function mockCurrentUser(page: Page, token: string) {
  await page.route('**/api/auth/me', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({ json: { data: { user } } });
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

  await page.goto('/dashboard');
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
  await expect(page).toHaveURL('/dashboard');
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

  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không chính xác');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
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
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
  await expect(page.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('ends a session at JWT expiry without waiting for another request', async ({ page }) => {
  const now = new Date();
  const token = tokenFor(Math.floor(now.getTime() / 1000) + 120);
  await page.clock.install({ time: now });
  await mockCurrentUser(page, token);
  await page.goto('/login');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: token,
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Roadmap của tôi' })).toBeVisible();
  await page.clock.fastForward(121_000);
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('shows a labeled and sortable demo without creating a session', async ({ page }, testInfo) => {
  await page.goto('/demo');
  const heading = page.getByRole('heading', { name: 'Roadmap của tôi' });
  await expect(heading).toHaveCSS('font-family', /Segoe UI/);
  await expect(heading).toHaveCSS('font-weight', '700');
  await expect(page.getByText('Dữ liệu minh họa', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo roadmap' })).toBeDisabled();
  const headings = page.getByRole('list', { name: 'Roadmap mẫu' }).getByRole('heading');
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
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
});
