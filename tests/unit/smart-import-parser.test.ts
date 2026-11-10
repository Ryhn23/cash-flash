import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceText, parseNominal } from '../../server/src/services/smart-import.js';

test('Smart Import Parser Unit Tests (Deterministic Non-LLM Extraction)', async (t) => {
  await t.test('parseNominal correctly parses various Rupiah formats', () => {
    assert.strictEqual(parseNominal('Rp 275.000'), 275000);
    assert.strictEqual(parseNominal('Rp. 1.500.000,00'), 1500000);
    assert.strictEqual(parseNominal('55000'), 55000);
    assert.strictEqual(parseNominal('IDR 12,500.00'), 12500);
    assert.strictEqual(parseNominal(''), 0);
  });

  await t.test('parseInvoiceText extracts standard Indonesian invoice text', () => {
    const invoiceText = `
      FAKTUR PEMBELIAN / INVOICE
      No Faktur: INV-2026/XI/088
      Tanggal: 10/11/2026
      Toko Alat Tulis Sejahtera

      Uraian: Kertas HVS A4 70gr SinarDunia
      Jumlah: 5 Rim
      Total Bayar: Rp 275.000
    `;

    const result = parseInvoiceText(invoiceText);

    assert.strictEqual(result.txDate, '2026-11-10');
    assert.strictEqual(result.description, 'Kertas HVS A4 70gr SinarDunia');
    assert.strictEqual(result.quantity, 5);
    assert.strictEqual(result.unit, 'Rim');
    assert.strictEqual(result.totalPrice, 275000);
    assert.strictEqual(result.unitPrice, 55000);
    assert.ok(result.verificationNote?.includes('INV-2026/XI/088'));
    assert.ok(result.confidence >= 80);
  });

  await t.test('parseInvoiceText parses Indonesian named months and box units', () => {
    const invoiceText = `
      NOTA PEMBELIAN KONSUMSI
      Tanggal: 15 Maret 2026
      No: NOTA-4431
      Snack Kotak Kue Tradisional
      Jumlah: 35 Dus
      Total: Rp 700.000
    `;

    const result = parseInvoiceText(invoiceText);

    assert.strictEqual(result.txDate, '2026-03-15');
    assert.strictEqual(result.quantity, 35);
    assert.strictEqual(result.unit, 'Dus');
    assert.strictEqual(result.totalPrice, 700000);
    assert.strictEqual(result.unitPrice, 20000);
    assert.ok(result.description.includes('Snack Kotak Kue Tradisional'));
  });

  await t.test('parseInvoiceText provides robust fallbacks for minimal/unstructured text', () => {
    const minimalText = `
      Struk Belanja Kasir
      Total: 45000
    `;

    const result = parseInvoiceText(minimalText);

    assert.ok(result.txDate.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.strictEqual(result.totalPrice, 45000);
    assert.strictEqual(result.quantity, 1);
    assert.strictEqual(result.unit, 'Unit');
    assert.strictEqual(result.unitPrice, 45000);
  });
});

