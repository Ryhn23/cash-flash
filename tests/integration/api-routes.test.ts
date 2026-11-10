import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { authRouter } from '../../server/src/routes/auth.js';
import { usersRouter } from '../../server/src/routes/users.js';
import { groupsRouter } from '../../server/src/routes/groups.js';
import { transactionsRouter } from '../../server/src/routes/transactions.js';
import { excelRouter } from '../../server/src/routes/excel.js';
import { analyticsRouter } from '../../server/src/routes/analytics.js';
import { auditRouter } from '../../server/src/routes/audit.js';
import { receiptsRouter } from '../../server/src/routes/receipts.js';
import { db } from '../../server/src/db/index.js';
import { users, sessions, financialGroups, groupMembers, groupCategories, transactions, auditLogs } from '../../server/src/db/schema.js';
import { hashPassword, hashToken, generateSessionToken, generateCsrfToken } from '../../server/src/utils/security.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../../server/src/types/env.js';

// Setup full test app
function createTestApp() {
  const app = new Hono<AppEnv>();
  app.route('/api/auth', authRouter);
  app.route('/api/users', usersRouter);
  app.route('/api/groups', groupsRouter);
  app.route('/api/groups', transactionsRouter);
  app.route('/api/groups', excelRouter);
  app.route('/api/groups', analyticsRouter);
  app.route('/api/groups', auditRouter);
  app.route('/api/audit', auditRouter);
  app.route('/uploads', receiptsRouter);
  return app;
}

test('Tahap 5: End-to-End API Routes QA Integration', async (t) => {
  const app = createTestApp();

  // Test credentials & identifiers
  const adminId = uuidv4();
  const adminEmail = `admin_api_${Date.now()}@test.com`;
  const adminPassword = 'AdminPassword123!';
  const adminPasswordHash = await hashPassword(adminPassword);

  let sessionCookie = '';
  let csrfToken = '';
  let createdGroupId = '';
  let createdCatId = '';
  let createdTxId = '';

  // 1. Seed admin user in SQLite
  db.insert(users).values({
    id: adminId,
    name: 'Admin API Tester',
    email: adminEmail,
    passwordHash: adminPasswordHash,
    systemRole: 'SUPER_ADMIN',
    isActive: 1,
  }).run();

  await t.test('POST /api/auth/login - authenticate user and issue session cookie', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, adminEmail);
    assert.ok(body.csrfToken, 'CSRF token must be returned in login response');
    csrfToken = body.csrfToken;

    // Extract session cookie from Set-Cookie header
    const setCookieHeader = res.headers.get('set-cookie');
    assert.ok(setCookieHeader, 'Set-Cookie header must be present');
    const match = setCookieHeader.match(/nextcash_session=([^;]+)/);
    assert.ok(match, 'Session cookie token must be found');
    sessionCookie = `nextcash_session=${match[1]}`;
  });

  await t.test('GET /api/auth/me - returns authenticated user profile & new csrf token', async () => {
    const res = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.id, adminId);
  });

  await t.test('POST /api/groups - create new financial workspace group', async () => {
    const res = await app.request('/api/groups', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        name: 'Workspace QA Test',
        slug: `ws-qa-${Date.now()}`,
        description: 'Workspace for QA End-to-End API testing',
        budgetLimit: 50000000,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.groupId);
    createdGroupId = body.groupId;
  });

  await t.test('GET /api/groups/:groupId/categories - retrieves default seeded categories', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/categories`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.categories));
    assert.ok(body.categories.length > 0);
    createdCatId = body.categories[0].id;
  });

  await t.test('POST /api/groups/:groupId/transactions - Forward Mode (Qty * UnitPrice)', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/transactions`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        txDate: '2026-11-01',
        type: 'EXPENSE',
        description: 'Sewa Gedung Rapat',
        categoryId: createdCatId,
        quantity: 2,
        unit: 'Hari',
        unitPrice: 2500000,
        calcMode: 'FORWARD',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.totalPrice, 5000000);
    assert.strictEqual(body.transaction.dataStatus, 'OK');
    createdTxId = body.transaction.id;
  });

  await t.test('POST /api/groups/:groupId/transactions - Reverse Mode (Total / Qty)', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/transactions`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        txDate: '2026-11-02',
        type: 'EXPENSE',
        description: 'Pembelian Catridge Printer',
        categoryId: createdCatId,
        quantity: 3,
        unit: 'Pcs',
        totalPrice: 178480,
        calcMode: 'REVERSE',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.totalPrice, 178480);
    assert.ok(Math.abs(body.transaction.unitPrice - 59493.333333333336) < 0.01);
  });

  await t.test('GET /api/groups/:groupId/transactions - List & Filter validation', async () => {
    // 1. All
    const resAll = await app.request(`/api/groups/${createdGroupId}/transactions`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.strictEqual(bodyAll.transactions.length, 2);

    // 2. Keyword Search
    const resSearch = await app.request(`/api/groups/${createdGroupId}/transactions?search=Gedung`, {
      headers: { Cookie: sessionCookie },
    });
    const bodySearch = await resSearch.json();
    assert.strictEqual(bodySearch.transactions.length, 1);
    assert.strictEqual(bodySearch.transactions[0].description, 'Sewa Gedung Rapat');
  });

  await t.test('PATCH /api/groups/:groupId/transactions/:txId - Update transaction', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/transactions/${createdTxId}`, {
      method: 'PATCH',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        description: 'Sewa Gedung Rapat (Auditorium Utama)',
        unitPrice: 2600000,
        quantity: 2,
        calcMode: 'FORWARD',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.transaction.totalPrice, 5200000);
    assert.strictEqual(body.transaction.description, 'Sewa Gedung Rapat (Auditorium Utama)');
  });

  await t.test('POST /api/groups/:groupId/transactions/:txId/receipt - Safe image upload', async () => {
    // Construct multipart form data with valid PNG magic bytes
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'receipt.png');

    const res = await app.request(`/api/groups/${createdGroupId}/transactions/${createdTxId}/receipt`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.receiptPath.endsWith('.png'));

    // Verify GET /uploads/:filename with authentication
    const getResAuth = await app.request(`/uploads/${body.receiptPath}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(getResAuth.status, 200);
    assert.strictEqual(getResAuth.headers.get('content-type'), 'image/png');

    // Verify GET /uploads/:filename WITHOUT authentication is REJECTED (401)
    const getResUnauth = await app.request(`/uploads/${body.receiptPath}`);
    assert.strictEqual(getResUnauth.status, 401);
  });

  await t.test('GET /api/groups/:groupId/analytics - Telemetry & Reconciliation', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/analytics`, {
      headers: { Cookie: sessionCookie },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.kpis.totalTransactions, 2);
    // Total expense = 5.200.000 + 178.480 = 5.378.480
    assert.strictEqual(body.kpis.totalExpense, 5378480);
    // Ledger sum must equal category sum -> OK - Sama
    assert.strictEqual(body.kpis.reconciliationStatus, 'OK - Sama');
    assert.strictEqual(body.kpis.sumFromLedger, 5378480);
    assert.strictEqual(body.kpis.sumFromCategoryBreakdown, 5378480);
  });

  await t.test('GET /api/groups/:groupId/audit - verify audit trail records', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/audit`, {
      headers: { Cookie: sessionCookie },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.logs));
    assert.ok(body.logs.length >= 2, 'Should have logged CREATE and UPDATE actions');
    assert.ok(body.logs.some((l: any) => l.action === 'CREATE_TRANSACTION'));
    assert.ok(body.logs.some((l: any) => l.action === 'UPDATE_TRANSACTION'));
  });

  await t.test('DELETE /api/groups/:groupId/transactions/:txId - remove transaction', async () => {
    const res = await app.request(`/api/groups/${createdGroupId}/transactions/${createdTxId}`, {
      method: 'DELETE',
      headers: {
        Cookie: sessionCookie,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  await t.test('POST /api/auth/logout - clear session and invalidate token', async () => {
    const res = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': csrfToken,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    // After logout, accessing protected route must fail with 401
    const resAfter = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(resAfter.status, 401);
  });

  // Cleanup test fixtures
  db.delete(auditLogs).where(eq(auditLogs.actorId, adminId)).run();
  if (createdGroupId) {
    db.delete(financialGroups).where(eq(financialGroups.id, createdGroupId)).run();
  }
  db.delete(users).where(eq(users.id, adminId)).run();
});
