import { test, expect } from '@playwright/test';

test.describe('E2E Stage 3: GROUP_MANAGER User Workflow (Anomaly Resolution & Group Governance)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as GROUP_MANAGER (Bendahara)
    await page.goto('/');
    await page.getByLabel('Alamat Email').fill('bendahara@safir.org');
    await page.getByLabel('Kata Sandi').fill('SafirPassword123!');
    await page.getByRole('button', { name: /Masuk/i }).click();
    await expect(page.locator('aside')).toContainText('Fathir Bendahara');
  });

  test('MANAGER can review Dashboard KPIs and Category Breakdown', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ringkasan Keuangan' })).toBeVisible();

    // Verify KPI Cards are present
    await expect(page.getByText('TOTAL PENGELUARAN')).toBeVisible();
    await expect(page.getByText('PAGU ANGGARAN')).toBeVisible();
    await expect(page.getByText('SISA ANGGARAN')).toBeVisible();
    await expect(page.getByText('JUMLAH TRANSAKSI')).toBeVisible();
    await expect(page.getByText('REKONSILIASI KAS')).toBeVisible();

    // Verify Category Breakdown Table
    await expect(page.getByRole('heading', { name: 'Pengeluaran per Kategori' })).toBeVisible();
  });

  test('MANAGER can verify duplicate transaction and resolve anomaly flag', async ({ page }) => {
    // Navigate to Ledger
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    // Find row with "Bukan Dobel" button (only GROUP_MANAGER has canManage: true)
    const bukanDobelBtn = page.getByRole('button', { name: 'Bukan Dobel' }).first();
    
    if (await bukanDobelBtn.isVisible()) {
      await bukanDobelBtn.click();

      // Modal opens
      const modal = page.locator('div[role="dialog"]');
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('heading', { name: 'Konfirmasi Transaksi Bukan Duplikat' })).toBeVisible();

      // Fill mandatory verification note
      const noteInput = modal.locator('textarea');
      await noteInput.fill('Pengeluaran terpisah untuk sesi pagi dan sore yang sah');

      // Click Confirm
      await modal.getByRole('button', { name: 'Konfirmasi Bukan Dobel' }).click();
      await expect(modal).not.toBeVisible();

      // Verify row status updated to Verified OK
      await expect(page.locator('table')).toContainText('Verified OK');
    }
  });

  test('MANAGER can update group settings and budget limit', async ({ page }) => {
    // Navigate to Group Settings
    await page.locator('button[title="Pengaturan Grup"]').click();
    await expect(page.getByRole('heading', { name: 'Pengaturan Grup & Pagu' })).toBeVisible();

    // Fill new budget limit
    const budgetInput = page.locator('input[value*="Rp"]').first();
    await budgetInput.fill('85000000');

    // Submit settings form
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

    // Verify alert message
    await expect(page.getByText('Pengaturan grup berhasil disimpan!')).toBeVisible();
  });

  test('MANAGER can open Audit Trail drawer and inspect live log entries', async ({ page }) => {
    // Open Audit Trail drawer
    await page.getByTitle(/Riwayat Aktivitas/i).first().click();

    // Verify drawer is open with heading "Riwayat Aktivitas & Log"
    const drawer = page.locator('.fixed.inset-y-0.right-0');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: /Riwayat/i })).toBeVisible();

    // Close drawer via xmark button
    await drawer.locator('button:has(i.fa-xmark)').click();
    await expect(drawer).not.toBeVisible();
  });
});
