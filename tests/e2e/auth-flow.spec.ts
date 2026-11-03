import { test, expect } from '@playwright/test';

test.describe('E2E Stage 1: Authentication & Session Gatekeeping', () => {
  test('unauthenticated user is redirected to LoginPage', async ({ page }) => {
    await page.goto('/');
    // Check brand and form elements
    await expect(page.locator('h1')).toContainText('Next-Cash');
    await expect(page.getByLabel('Alamat Email')).toBeVisible();
    await expect(page.getByLabel('Kata Sandi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Masuk ke Ledger' })).toBeVisible();
  });

  test('login with invalid credentials displays error banner', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Alamat Email').fill('staf@safir.org');
    await page.getByLabel('Kata Sandi').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Masuk ke Ledger' }).click();

    // Verify error banner
    const errorAlert = page.locator('.bg-rose-50');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Email atau kata sandi tidak valid');
  });

  test('login with valid credentials successfully navigates to application workspace', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Alamat Email').fill('staf@safir.org');
    await page.getByLabel('Kata Sandi').fill('SafirPassword123!');
    await page.getByRole('button', { name: 'Masuk ke Ledger' }).click();

    // Verify workspace loaded
    await expect(page.getByRole('heading', { name: 'Ringkasan Keuangan' })).toBeVisible();
    await expect(page.locator('aside')).toContainText('BELANJA SAFIR');
    await expect(page.locator('aside')).toContainText('Ahmad Staf Pencatat');

    // Logout
    await page.locator('button[title="Keluar (Logout)"]').click();
    await expect(page.getByRole('button', { name: 'Masuk ke Ledger' })).toBeVisible();
  });
});

