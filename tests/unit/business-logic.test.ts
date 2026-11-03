import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTransactionDataStatus, recalculateGroupAnomalies } from '../../server/src/services/anomaly.js';
import { db } from '../../server/src/db/index.js';
import { transactions, financialGroups, users, groupCategories } from '../../server/src/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

test('Tahap 2: Core Business Logic & Anomaly Detection', async (t) => {
  await t.test('Completeness check (INCOMPLETE status)', () => {
    // Missing date
    const r1 = evaluateTransactionDataStatus(
      { txDate: '', description: 'Beli ATK', categoryId: 'cat-1', quantity: 1, unitPrice: 1000, totalPrice: 1000 },
      []
    );
    assert.strictEqual(r1.status, 'INCOMPLETE');

    // Empty description
    const r2 = evaluateTransactionDataStatus(
      { txDate: '2026-11-01', description: '   ', categoryId: 'cat-1', quantity: 1, unitPrice: 1000, totalPrice: 1000 },
      []
    );
    assert.strictEqual(r2.status, 'INCOMPLETE');

    // Missing category
    const r3 = evaluateTransactionDataStatus(
      { txDate: '2026-11-01', description: 'Beli ATK', categoryId: null, quantity: 1, unitPrice: 1000, totalPrice: 1000 },
      []
    );
    assert.strictEqual(r3.status, 'INCOMPLETE');

    // Zero quantity
    const r4 = evaluateTransactionDataStatus(
      { txDate: '2026-11-01', description: 'Beli ATK', categoryId: 'cat-1', quantity: 0, unitPrice: 1000, totalPrice: 1000 },
      []
    );
    assert.strictEqual(r4.status, 'INCOMPLETE');

    // Negative unit price
    const r5 = evaluateTransactionDataStatus(
      { txDate: '2026-11-01', description: 'Beli ATK', categoryId: 'cat-1', quantity: 1, unitPrice: -500, totalPrice: 1000 },
      []
    );
    assert.strictEqual(r5.status, 'INCOMPLETE');
  });

  await t.test('Potential duplicate check (POTENTIAL_DUPLICATE)', () => {
    const existing = [
      {
        id: 'tx-1',
        txDate: '2026-11-01',
        description: 'Pembelian Snack Rapat Panitia',
        totalPrice: 150000,
        dataStatus: 'OK' as const,
      },
    ];

    // Same date, same total price, similar description with punctuation differences
    const checkDup = evaluateTransactionDataStatus(
      {
        id: 'tx-2',
        txDate: '2026-11-01',
        description: '  pembelian  snack  rapat  panitia! ',
        categoryId: 'cat-1',
        quantity: 1,
        unitPrice: 150000,
        totalPrice: 150000,
      },
      existing
    );

    assert.strictEqual(checkDup.status, 'POTENTIAL_DUPLICATE');
    assert.strictEqual(checkDup.duplicateCount, 2);

    // Different date -> NOT duplicate
    const diffDate = evaluateTransactionDataStatus(
      {
        id: 'tx-3',
        txDate: '2026-11-02',
        description: 'Pembelian Snack Rapat Panitia',
        categoryId: 'cat-1',
        quantity: 1,
        unitPrice: 150000,
        totalPrice: 150000,
      },
      existing
    );
    assert.strictEqual(diffDate.status, 'OK');

    // Different total price -> NOT duplicate
    const diffPrice = evaluateTransactionDataStatus(
      {
        id: 'tx-4',
        txDate: '2026-11-01',
        description: 'Pembelian Snack Rapat Panitia',
        categoryId: 'cat-1',
        quantity: 1,
        unitPrice: 200000,
        totalPrice: 200000,
      },
      existing
    );
    assert.strictEqual(diffPrice.status, 'OK');
  });

  await t.test('Preserve VERIFIED_DUPLICATE_OK status', () => {
    const existing = [
      {
        id: 'tx-1',
        txDate: '2026-11-01',
        description: 'Pembelian Kopi',
        totalPrice: 50000,
        dataStatus: 'OK' as const,
      },
    ];

    const verified = evaluateTransactionDataStatus(
      {
        id: 'tx-2',
        txDate: '2026-11-01',
        description: 'Pembelian Kopi',
        categoryId: 'cat-1',
        quantity: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        dataStatus: 'VERIFIED_DUPLICATE_OK',
        verificationNote: 'Sesi pagi dan sesi sore memang terpisah',
      },
      existing
    );

    assert.strictEqual(verified.status, 'VERIFIED_DUPLICATE_OK');
  });

  await t.test('Dual-Direction Calculation Logic', () => {
    // Mode A: Forward Calculation (Qty * UnitPrice = Total)
    const qtyA = 3.5;
    const unitPriceA = 45000;
    const totalA = Math.round(qtyA * unitPriceA);
    assert.strictEqual(totalA, 157500);

    // Mode B: Reverse Split (Total / Qty = UnitPrice with fractional precision)
    // 3 unit seharga total Rp 178.480 (178480 / 3 = 59493.3333...)
    const qtyB = 3;
    const totalB = 178480;
    const unitPriceB = totalB / qtyB;
    assert.ok(Math.abs(unitPriceB - 59493.333333333336) < 0.001);
    // Preserves exact integer total when multiplied and rounded
    assert.strictEqual(Math.round(qtyB * unitPriceB), 178480);
  });

  await t.test('Database Dynamic Anomaly Recalculation (recalculateGroupAnomalies)', async () => {
    // Setup temporary test user, group, and category in SQLite
    const testUserId = uuidv4();
    const testGroupId = uuidv4();
    const testCatId = uuidv4();

    db.insert(users).values({
      id: testUserId,
      name: 'Tester Anomaly',
      email: `test_anomaly_${Date.now()}@example.com`,
      passwordHash: 'dummy',
      systemRole: 'USER',
    }).run();

    db.insert(financialGroups).values({
      id: testGroupId,
      name: 'Test Anomaly Group',
      slug: `test-anomaly-${Date.now()}`,
      createdBy: testUserId,
    }).run();

    db.insert(groupCategories).values({
      id: testCatId,
      groupId: testGroupId,
      name: 'Operasional',
      type: 'EXPENSE',
    }).run();

    const tx1Id = uuidv4();
    const tx2Id = uuidv4();

    // Insert 2 identical rows -> both should become POTENTIAL_DUPLICATE
    db.insert(transactions).values([
      {
        id: tx1Id,
        groupId: testGroupId,
        txDate: '2026-11-05',
        description: 'Sewa Tenda Acara',
        categoryId: testCatId,
        quantity: 1,
        unit: 'Paket',
        unitPrice: 500000,
        totalPrice: 500000,
        dataStatus: 'OK',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      {
        id: tx2Id,
        groupId: testGroupId,
        txDate: '2026-11-05',
        description: 'sewa tenda acara',
        categoryId: testCatId,
        quantity: 1,
        unit: 'Paket',
        unitPrice: 500000,
        totalPrice: 500000,
        dataStatus: 'OK',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    ]).run();

    // Run recalculation
    recalculateGroupAnomalies(testGroupId);

    const check1 = db.select().from(transactions).where(eq(transactions.groupId, testGroupId)).all();
    assert.strictEqual(check1.length, 2);
    assert.strictEqual(check1[0].dataStatus, 'POTENTIAL_DUPLICATE');
    assert.strictEqual(check1[1].dataStatus, 'POTENTIAL_DUPLICATE');

    // Now delete one duplicate row
    db.delete(transactions).where(eq(transactions.id, tx2Id)).run();

    // Recalculate again -> remaining row must revert to 'OK' automatically!
    recalculateGroupAnomalies(testGroupId);

    const check2 = db.select().from(transactions).where(eq(transactions.id, tx1Id)).get();
    assert.ok(check2);
    assert.strictEqual(check2.dataStatus, 'OK', 'Remaining transaction must revert to OK when duplicate is deleted');

    // Clean up test group
    db.delete(financialGroups).where(eq(financialGroups.id, testGroupId)).run();
    db.delete(users).where(eq(users.id, testUserId)).run();
  });
});

