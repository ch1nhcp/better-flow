import { expect, test } from '@playwright/test';

const validJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  Buffer.from(
    JSON.stringify({ sub: 1, exp: Math.floor(Date.now() / 1000) + 3600 }),
    'utf8',
  ).toString('base64url') +
  '.signature';

test('shares a roadmap from workspace menu and views public share link', async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem('betterflow.authToken', token);
  }, validJwt);

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user: { id: 1, email: 'quang@cmc.com.vn', createdAt: '2026-11-04T07:00:00.000Z' } },
      }),
    }),
  );

  let isPublic = false;
  let shareCode: string | null = null;

  await page.route('**/api/roadmaps', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          roadmaps: [
            {
              id: 10,
              title: 'Onboarding Frontend',
              nodeCount: 2,
              previewNodes: [
                { id: 'n1', label: 'Chuẩn bị môi trường' },
                { id: 'n2', label: 'Nền tảng TypeScript' },
              ],
              isPublic,
              shareCode,
              createdAt: '2026-11-04T07:10:00.000Z',
              updatedAt: '2026-11-04T08:30:00.000Z',
            },
          ],
        },
      }),
    }),
  );

  await page.route('**/api/roadmaps/10/share', async (route) => {
    const body = route.request().postDataJSON() as { isPublic: boolean };
    isPublic = body.isPublic;
    if (isPublic && !shareCode) {
      shareCode = 'k8f2xq';
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 10, isPublic, shareCode } }),
    });
  });

  await page.route('**/api/share/*', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/k8f2xq') && isPublic) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            roadmap: {
              title: 'Onboarding Frontend',
              nodes: [
                {
                  id: 'n1',
                  type: 'default',
                  position: { x: 100, y: 50 },
                  data: { label: 'Chuẩn bị môi trường', description: 'Cài Git và Node.js' },
                },
                {
                  id: 'n2',
                  type: 'default',
                  position: { x: 100, y: 200 },
                  data: { label: 'Nền tảng TypeScript' },
                },
              ],
              edges: [{ id: 'edge-n1-n2', source: 'n1', target: 'n2', type: 'smoothstep' }],
              authorEmail: 'quang@cmc.com.vn',
              updatedAt: '2026-11-04T08:30:00.000Z',
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'NOT_FOUND', message: 'Link chia sẻ không tồn tại hoặc đã bị tắt.' },
      }),
    });
  });

  await page.goto('/roadmaps');
  await expect(page.getByText('Onboarding Frontend')).toBeVisible();

  await page.getByRole('button', { name: 'Tùy chọn cho Onboarding Frontend' }).click();
  await page.getByRole('button', { name: 'Chia sẻ' }).click();

  const dialog = page.getByRole('dialog', { name: 'Chia sẻ roadmap' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Chưa có liên kết chia sẻ', { exact: false })).toBeVisible();

  await dialog.getByLabel('Chia sẻ bằng liên kết').click();
  await expect(dialog.getByLabel('Liên kết chỉ xem')).toHaveValue(/\/share\/k8f2xq$/);

  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(dialog).toBeHidden();

  await page.goto('/share/k8f2xq');
  await expect(page.getByRole('heading', { name: 'Onboarding Frontend' })).toBeVisible();
  await expect(page.getByText('Chỉ xem', { exact: true })).toBeVisible();
  await expect(page.getByText('Chuẩn bị môi trường')).toBeVisible();
  await expect(page.getByText('quang@cmc.com.vn')).toHaveCount(0);

  await page.goto('/share/missing1');
  await expect(page.getByRole('heading', { name: 'Liên kết không khả dụng' })).toBeVisible();
});
