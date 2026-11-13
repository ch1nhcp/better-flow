import { expect, test } from '@playwright/test';

test('the login page uses the prototype typography and fits the viewport', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page).toHaveURL('/login');
  const heading = page.getByRole('heading', { name: 'Chào mừng trở lại' });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('font-family', /Segoe UI/);
  await expect(heading).toHaveCSS('font-weight', '700');
  await expect(page.getByLabel('Email')).toHaveCSS('font-family', /Segoe UI/);
  await expect(page.getByText('01', { exact: true })).toHaveCSS('font-family', /Consolas/);
  const health = await page.request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
});

test('unknown URLs show a 404 page and can navigate home', async ({ page }) => {
  await page.goto('/not-a-route');
  const heading = page.getByRole('heading', { name: 'Trang này chưa tồn tại.' });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('font-family', /IBM Plex Sans/);
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL('/login');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();
});
