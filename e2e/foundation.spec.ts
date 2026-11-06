import { expect, test } from '@playwright/test';

test('starter connects to the API and fits the viewport', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Một khởi đầu cho cả đội.' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API đã kết nối');
  const fontsLoaded = await page.evaluate(async () => {
    const fonts = await Promise.all([
      document.fonts.load('400 16px "IBM Plex Sans"', 'Nền tảng'),
      document.fonts.load('500 56px "IBM Plex Sans"', 'Một khởi đầu cho cả đội.'),
      document.fonts.load('400 12px "IBM Plex Mono"', 'API đã kết nối'),
    ]);
    return fonts.every((faces) => faces.length > 0);
  });
  expect(fontsLoaded).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('starter.png'), fullPage: true });
});

test('unknown URLs show a 404 page and can navigate home', async ({ page }) => {
  await page.goto('/not-a-route');
  await expect(page.getByRole('heading', { name: 'Trang này chưa tồn tại.' })).toBeVisible();
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Một khởi đầu cho cả đội.' })).toBeVisible();
});
