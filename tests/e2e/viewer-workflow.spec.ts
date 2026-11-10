import { test, expect } from '@playwright/test';

test.describe('E2E Stage 4: VIEWER User Workflow (Read-Only Enforcement)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as VIEWER (Auditor)
    await page.goto('/');
    await page.getByLabel('Alamat Email').fill('auditor@safir.org');
    await page.getByLabel('Kata Sandi').fill('SafirPassword123!');
    await page.getByRole('button', { name: /Masuk/i }).click();
    await expect(page.locator('aside')).toContainText('Dewi Auditor');
  });

  test('VIEWER can view ledger data but mutation buttons are completely hidden', async ({ page }) => {
    // Navigate to Ledger
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    // Verify table has rows rendered
    await expect(page.locator('table tbody tr')).not.toHaveCount(0);

    // 1. "Tambah Transaksi" button MUST NOT exist for VIEWER
    await expect(page.getByRole('button', { name: 'Tambah Transaksi' })).toHaveCount(0);

    // 2. "Impor Excel" button MUST NOT exist for VIEWER
    await expect(page.getByRole('button', { name: /Impor Excel|Import Excel/i })).toHaveCount(0);

    // 3. Row action buttons (Edit, Delete, Verify Duplicate) MUST NOT exist for VIEWER
    await expect(page.locator('button[title="Ubah Transaksi"]')).toHaveCount(0);
    await expect(page.locator('button[title="Hapus Transaksi"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bukan Dobel' })).toHaveCount(0);

    // 4. "Unduh Excel" button MUST BE visible for VIEWER
    await expect(page.getByRole('button', { name: /Unduh Excel|Export \.xlsx/i })).toBeVisible();
  });

  test('VIEWER can inspect dashboard analytics telemetry', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ringkasan Keuangan' })).toBeVisible();
    await expect(page.getByText('TOTAL PENGELUARAN')).toBeVisible();
    await expect(page.getByText('PAGU ANGGARAN')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pengeluaran per Kategori' })).toBeVisible();
  });

  test('VIEWER cannot see Admin Panel in sidebar', async ({ page }) => {
    await expect(page.locator('button[title="Konsol Admin"]')).toHaveCount(0);
  });
});

