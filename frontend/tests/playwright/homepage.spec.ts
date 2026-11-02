import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Noviq/i);
});

test('navigation works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /services/i }).click();
  await expect(page).toHaveURL(/\/services/);
});

test('i18n routes work', async ({ page }) => {
  await page.goto('/ar');
  await expect(page).toHaveURL(/\/ar/);
});
