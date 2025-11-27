import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('login page renders form controls', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
