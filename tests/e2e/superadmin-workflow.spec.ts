import { test, expect } from '@playwright/test';

test.describe('E2E Stage 5: SUPER_ADMIN User Workflow (System Governance & Universal Bypass)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as SUPER_ADMIN
    await page.goto('/');
    await page.getByLabel('Alamat Email').fill('admin@nextcash.io');
    await page.getByLabel('Kata Sandi').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Masuk/i }).click();
    await expect(page.locator('aside')).toContainText('Administrator Utama');
  });

  test('SUPER_ADMIN can access Admin Panel tab in sidebar', async ({ page }) => {
    const adminTab = page.locator('button[title="Konsol Admin"]');
    await expect(adminTab).toBeVisible();
    await adminTab.click();

    // Verify Admin Header and Tabs
    await expect(page.getByRole('heading', { name: 'Konsol Administrasi' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pengguna/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Grup Keuangan/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Riwayat Aktivitas|Audit Global/i })).toBeVisible();
  });

  test('SUPER_ADMIN can create a new system user via modal', async ({ page }) => {
    await page.locator('button[title="Konsol Admin"]').click();
    await expect(page.getByRole('heading', { name: 'Konsol Administrasi' })).toBeVisible();

    // Click "Tambah Pengguna Baru"
    await page.getByRole('button', { name: 'Tambah Pengguna Baru' }).click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Tambah Akun Pengguna Baru' })).toBeVisible();

    const testEmail = `newuser_e2e_${Date.now()}@test.com`;

    // Fill user form
    await modal.getByLabel('Nama Lengkap').fill('Budi Testing E2E');
    await modal.getByLabel('Alamat Email').fill(testEmail);
    await modal.getByLabel('Kata Sandi Awal').fill('Password123!');

    // Submit
    await modal.getByRole('button', { name: 'Buat Pengguna' }).click();
    await expect(modal).not.toBeVisible();

    // Verify user appears in admin table
    await expect(page.locator('table')).toContainText(testEmail);
  });

  test('SUPER_ADMIN can inspect global financial groups and audit logs', async ({ page }) => {
    await page.locator('button[title="Konsol Admin"]').click();
    await expect(page.getByRole('heading', { name: 'Konsol Administrasi' })).toBeVisible();

    // Switch to Grup Keuangan tab
    await page.getByRole('button', { name: /Grup Keuangan/ }).click();
    await expect(page.locator('main')).toContainText('BELANJA SAFIR');

    // Switch to Riwayat Aktivitas tab
    await page.getByRole('button', { name: /Riwayat Aktivitas|Audit Global/i }).click();
    await expect(page.locator('table')).toBeVisible();
  });

  test('SUPER_ADMIN has universal access to Belanja Safir ledger with full mutation power', async ({ page }) => {
    // Navigate to Ledger
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    // Verify Super Admin can add transactions
    await expect(page.getByRole('button', { name: 'Tambah Transaksi' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Impor Excel|Import Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Unduh Excel|Export \.xlsx/i })).toBeVisible();
  });
});
