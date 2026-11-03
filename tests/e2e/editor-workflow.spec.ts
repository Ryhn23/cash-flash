import { test, expect } from '@playwright/test';

test.describe('E2E Stage 2: EDITOR User Workflow (Ledger Operations & Dual-Calc)', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console & network errors
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.log(`HTTP ${res.status()} ${res.url()}`);
      }
    });

    // Login as EDITOR
    await page.goto('/');
    await page.getByLabel('Alamat Email').fill('staf@safir.org');
    await page.getByLabel('Kata Sandi').fill('SafirPassword123!');
    await page.getByRole('button', { name: 'Masuk ke Ledger' }).click();
    await expect(page.locator('aside')).toContainText('Ahmad Staf Pencatat');
  });

  test('EDITOR can create transaction in Forward Mode (Qty * UnitPrice)', async ({ page }) => {
    // Navigate to Ledger
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    const addBtn = page.getByRole('button', { name: 'Tambah Transaksi' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Use modal scope
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Fill form inside modal
    await modal.getByLabel('Uraian / Deskripsi Belanja').fill('Kertas HVS A4 70gr E2E Forward');
    await modal.getByLabel('Kategori Pengeluaran').selectOption({ index: 1 });

    const qtyInput = modal.getByLabel('Jumlah (Qty)');
    await qtyInput.fill('4');

    const unitPriceInput = modal.locator('input[placeholder="0"]');
    await unitPriceInput.fill('45000');

    // Wait for auto-computed Total
    const totalInput = modal.locator('input[placeholder="Rp 0"]');
    await expect(totalInput).toHaveValue(/180\.000/);

    // Click submit inside modal
    await modal.getByRole('button', { name: 'Simpan Transaksi' }).click();

    // Wait for modal to disappear
    await expect(modal).not.toBeVisible();

    // Verify row appeared in TanStack table
    await expect(page.locator('table')).toContainText('Kertas HVS A4 70gr E2E Forward');
  });

  test('EDITOR can create transaction in Reverse Split Mode (Total / Qty)', async ({ page }) => {
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    await page.getByRole('button', { name: 'Tambah Transaksi' }).click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Switch to Reverse Split Mode
    await modal.getByRole('button', { name: 'Mode B: Split dari Total Nota' }).click();

    await modal.getByLabel('Uraian / Deskripsi Belanja').fill('Tinta Printer Epson E2E Reverse');
    await modal.getByLabel('Kategori Pengeluaran').selectOption({ index: 1 });

    await modal.getByLabel('Jumlah (Qty)').fill('3');

    const totalInput = modal.locator('input[placeholder="Rp 0"]');
    await totalInput.fill('178480');

    const unitPriceInput = modal.locator('input[placeholder="0"]');
    await expect(unitPriceInput).toHaveValue('59493.33');

    await modal.getByRole('button', { name: 'Simpan Transaksi' }).click();
    await expect(modal).not.toBeVisible();

    await expect(page.locator('table')).toContainText('Tinta Printer Epson E2E Reverse');
  });

  test('EDITOR interactive search and filter in table', async ({ page }) => {
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    const searchInput = page.getByPlaceholder('Cari uraian, kategori, catatan...');
    await searchInput.fill('Kertas HVS A4 70gr E2E Forward');

    await expect(page.locator('table')).toContainText('Kertas HVS A4 70gr E2E Forward');
    await expect(page.locator('table')).not.toContainText('Tinta Printer Epson E2E Reverse');

    await searchInput.fill('');
    await expect(page.locator('table')).toContainText('Tinta Printer Epson E2E Reverse');
  });

  test('EDITOR cannot verify duplicates (no "Bukan Dobel" button in action column)', async ({ page }) => {
    await page.locator('button[title="Buku Kas Belanja"]').click();
    await expect(page.getByRole('heading', { name: 'Buku Kas Belanja' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Bukan Dobel' })).toHaveCount(0);
  });
});
