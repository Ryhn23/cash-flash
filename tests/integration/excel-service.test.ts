import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  generateSafirExcelWorkbook,
  parseAndValidateExcel,
  commitImportedRows,
  type ExportTransactionData,
} from '../../server/src/services/excel.js';
import { db } from '../../server/src/db/index.js';
import { users, financialGroups, groupCategories, transactions } from '../../server/src/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

test('Tahap 3: Excel Engine Integration (Export, Import Preview & Commit)', async (t) => {
  const sampleTransactions: ExportTransactionData[] = [
    {
      id: 'tx-1',
      txDate: '2026-11-01',
      type: 'EXPENSE',
      description: 'Konsumsi Rapat',
      categoryName: 'Konsumsi',
      quantity: 10,
      unit: 'Kotak',
      unitPrice: 25000,
      totalPrice: 250000,
      dataStatus: 'OK',
      creatorName: 'Ahmad Pencatat',
      verificationNote: null,
    },
    {
      id: 'tx-2',
      txDate: '2026-11-02',
      type: 'EXPENSE',
      description: '=MALICIOUS_FORMULA()',
      categoryName: 'Transportasi',
      quantity: 2,
      unit: 'Tiket',
      unitPrice: 150000,
      totalPrice: 300000,
      dataStatus: 'POTENTIAL_DUPLICATE',
      creatorName: 'Ahmad Pencatat',
      verificationNote: null,
    },
  ];

  const sampleCategories = [
    { name: 'Konsumsi', budgetAllocation: 2000000 },
    { name: 'Transportasi', budgetAllocation: 5000000 },
  ];

  let generatedBuffer: ExcelJS.Buffer;

  await t.test('generateSafirExcelWorkbook produces valid multi-sheet workbook with live formulas', async () => {
    generatedBuffer = await generateSafirExcelWorkbook('Grup Test Safir', sampleTransactions, sampleCategories);
    assert.ok(generatedBuffer, 'Workbook buffer should be generated');

    // Reload workbook with ExcelJS to inspect contents
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(generatedBuffer as any);

    const belanjaSheet = wb.getWorksheet('Belanja');
    assert.ok(belanjaSheet, 'Sheet "Belanja" must exist');

    const ringkasanSheet = wb.getWorksheet('Ringkasan');
    assert.ok(ringkasanSheet, 'Sheet "Ringkasan" must exist');

    // Verify Belanja header & formulas
    const row5 = belanjaSheet.getRow(5);
    // Column 7 has formula for Total: ROUND(D5*F5,0)
    const totalCell = row5.getCell(7);
    assert.ok(typeof totalCell.value === 'object' && 'formula' in totalCell.value, 'Total price cell must have live formula');
    assert.strictEqual((totalCell.value as any).formula, 'ROUND(D5*F5,0)');

    // Verify formula injection sanitization on description in row 6
    const row6 = belanjaSheet.getRow(6);
    const descCell = row6.getCell(3);
    assert.ok(String(descCell.value).startsWith("'="), 'Malicious formula must be escaped with leading apostrophe');

    // Verify Ringkasan sheet formulas
    // Categories row (starts row 4)
    const rRow4 = ringkasanSheet.getRow(4);
    const countFormulaCell = rRow4.getCell(3);
    assert.ok(typeof countFormulaCell.value === 'object' && 'formula' in countFormulaCell.value);
    assert.ok((countFormulaCell.value as any).formula.includes('COUNTIFS'));

    const sumFormulaCell = rRow4.getCell(4);
    assert.ok(typeof sumFormulaCell.value === 'object' && 'formula' in sumFormulaCell.value);
    assert.ok((sumFormulaCell.value as any).formula.includes('SUMIFS'));
  });

  await t.test('parseAndValidateExcel parses Excel buffer and detects duplicates & incomplete rows', async () => {
    // Setup test group in SQLite
    const testGroupId = uuidv4();
    const testUserId = uuidv4();
    const testCatId = uuidv4();

    db.insert(users).values({
      id: testUserId,
      name: 'User Excel Test',
      email: `excel_test_${Date.now()}@example.com`,
      passwordHash: 'dummy',
      systemRole: 'USER',
    }).run();

    db.insert(financialGroups).values({
      id: testGroupId,
      name: 'Group Excel Test',
      slug: `group-excel-${Date.now()}`,
      createdBy: testUserId,
    }).run();

    db.insert(groupCategories).values({
      id: testCatId,
      groupId: testGroupId,
      name: 'Konsumsi',
      type: 'EXPENSE',
    }).run();

    // Create an in-memory workbook to test parser
    const testWb = new ExcelJS.Workbook();
    const ws = testWb.addWorksheet('Belanja');
    ws.addRow(['No', 'Tanggal', 'Uraian', 'Jumlah', 'Satuan', 'Harga Satuan', 'Total', 'Kategori', 'Tipe']);
    // Row 2: Valid
    ws.addRow([1, '2026-11-10', 'Beli Air Mineral', 5, 'Dus', 30000, 150000, 'Konsumsi', 'Pengeluaran']);
    // Row 3: Incomplete (zero total & zero price)
    ws.addRow([2, '2026-11-10', 'Beli Kopi Tanpa Harga', 1, 'Pcs', 0, 0, 'Konsumsi', 'Pengeluaran']);
    // Row 4: Duplicate of Row 2
    ws.addRow([3, '2026-11-10', 'beli air mineral', 5, 'Dus', 30000, 150000, 'Konsumsi', 'Pengeluaran']);

    const buffer = Buffer.from(await testWb.xlsx.writeBuffer());

    const preview = await parseAndValidateExcel(buffer, testGroupId, [{ id: testCatId, name: 'Konsumsi' }]);

    assert.strictEqual(preview.totalRows, 3);
    assert.strictEqual(preview.validCount, 1);
    assert.strictEqual(preview.incompleteCount, 1);
    assert.strictEqual(preview.duplicateCount, 1);

    // Commit only the valid row
    const validRows = preview.rows.filter((r) => r.status === 'OK');
    const committedCount = await commitImportedRows(testGroupId, testUserId, validRows);
    assert.strictEqual(committedCount, 1);

    const dbTxs = db.select().from(transactions).where(eq(transactions.groupId, testGroupId)).all();
    assert.strictEqual(dbTxs.length, 1);
    assert.strictEqual(dbTxs[0].description, 'Beli Air Mineral');
    assert.strictEqual(dbTxs[0].totalPrice, 150000);

    // Clean up
    db.delete(financialGroups).where(eq(financialGroups.id, testGroupId)).run();
    db.delete(users).where(eq(users.id, testUserId)).run();
  });
});

