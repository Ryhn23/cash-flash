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
import { db } from '../../server/src/db/index.js';
import {
  users,
  sessions,
  financialGroups,
  groupMembers,
  groupCategories,
  groupUnits,
  transactions,
  auditLogs,
} from '../../server/src/db/schema.js';
import { hashToken, generateSessionToken, generateCsrfToken } from '../../server/src/utils/security.js';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../../server/src/types/env.js';

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
  return app;
}

test('User Level QA Unit & Integration Tests (RBAC Matrix Verification)', async (t) => {
  const app = createTestApp();

  // Generated Identifiers
  const superAdminId = uuidv4();
  const managerId = uuidv4();
  const editorId = uuidv4();
  const viewerId = uuidv4();
  const nonMemberId = uuidv4();
  const inactiveId = uuidv4();
  let createdUserId = '';

  const groupAId = uuidv4();
  const groupBId = uuidv4();

  const superAdminToken = generateSessionToken();
  const managerToken = generateSessionToken();
  const editorToken = generateSessionToken();
  const viewerToken = generateSessionToken();
  const nonMemberToken = generateSessionToken();
  const inactiveToken = generateSessionToken();

  const superAdminCsrf = generateCsrfToken();
  const managerCsrf = generateCsrfToken();
  const editorCsrf = generateCsrfToken();
  const viewerCsrf = generateCsrfToken();
  const nonMemberCsrf = generateCsrfToken();
  const inactiveCsrf = generateCsrfToken();

  const headersFor = (token: string, csrf: string) => ({
    Cookie: `nextcash_session=${token}`,
    Host: 'localhost:3001',
    Origin: 'http://localhost:3001',
    'x-csrf-token': csrf,
    'Content-Type': 'application/json',
  });

  const getHeadersFor = (token: string) => ({
    Cookie: `nextcash_session=${token}`,
  });

  const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 1. Seed Users
  db.insert(users).values([
    { id: superAdminId, name: 'User Super Admin', email: `sa_${Date.now()}@test.com`, passwordHash: 'dummy', systemRole: 'SUPER_ADMIN', isActive: 1 },
    { id: managerId, name: 'User Group Manager', email: `mgr_${Date.now()}@test.com`, passwordHash: 'dummy', systemRole: 'USER', isActive: 1 },
    { id: editorId, name: 'User Editor', email: `ed_${Date.now()}@test.com`, passwordHash: 'dummy', systemRole: 'USER', isActive: 1 },
    { id: viewerId, name: 'User Viewer', email: `vw_${Date.now()}@test.com`, passwordHash: 'dummy', systemRole: 'USER', isActive: 1 },
    { id: nonMemberId, name: 'User Non Member', email: `nm_${Date.now()}@test.com`, passwordHash: 'dummy', systemRole: 'USER', isActive: 1 },
    { id: inactiveId, name: 'User Inactive', email: `inact_${Date.now()}@test.com`, passwordHash: 'dummy', systemRole: 'USER', isActive: 0 },
  ]).run();

  // 2. Seed Sessions
  db.insert(sessions).values([
    { id: uuidv4(), userId: superAdminId, tokenHash: hashToken(superAdminToken), csrfToken: superAdminCsrf, expiresAt: futureExpiry },
    { id: uuidv4(), userId: managerId, tokenHash: hashToken(managerToken), csrfToken: managerCsrf, expiresAt: futureExpiry },
    { id: uuidv4(), userId: editorId, tokenHash: hashToken(editorToken), csrfToken: editorCsrf, expiresAt: futureExpiry },
    { id: uuidv4(), userId: viewerId, tokenHash: hashToken(viewerToken), csrfToken: viewerCsrf, expiresAt: futureExpiry },
    { id: uuidv4(), userId: nonMemberId, tokenHash: hashToken(nonMemberToken), csrfToken: nonMemberCsrf, expiresAt: futureExpiry },
    { id: uuidv4(), userId: inactiveId, tokenHash: hashToken(inactiveToken), csrfToken: inactiveCsrf, expiresAt: futureExpiry },
  ]).run();

  // 3. Seed Groups (Group A & Group B)
  db.insert(financialGroups).values([
    { id: groupAId, name: 'Workspace Alpha (Group A)', slug: `ws-a-${Date.now()}`, createdBy: superAdminId, budgetLimit: 100000000 },
    { id: groupBId, name: 'Workspace Beta (Group B)', slug: `ws-b-${Date.now()}`, createdBy: superAdminId, budgetLimit: 50000000 },
  ]).run();

  // 4. Assign Memberships
  // In Group A: managerId is GROUP_MANAGER, editorId is EDITOR, viewerId is VIEWER.
  // In Group B: nonMemberId is GROUP_MANAGER.
  db.insert(groupMembers).values([
    { id: uuidv4(), groupId: groupAId, userId: managerId, groupRole: 'GROUP_MANAGER' },
    { id: uuidv4(), groupId: groupAId, userId: editorId, groupRole: 'EDITOR' },
    { id: uuidv4(), groupId: groupAId, userId: viewerId, groupRole: 'VIEWER' },
    { id: uuidv4(), groupId: groupBId, userId: nonMemberId, groupRole: 'GROUP_MANAGER' },
  ]).run();

  // 5. Seed Category & Sample Transaction in Group A
  const catAId = uuidv4();
  db.insert(groupCategories).values({
    id: catAId,
    groupId: groupAId,
    name: 'Konsumsi Rapat',
    type: 'EXPENSE',
    budgetAllocation: 5000000,
  }).run();

  const txA1Id = uuidv4();
  db.insert(transactions).values({
    id: txA1Id,
    groupId: groupAId,
    txDate: '2026-11-01',
    description: 'Nasi Kotak Siang',
    categoryId: catAId,
    quantity: 10,
    unit: 'Kotak',
    unitPrice: 35000,
    totalPrice: 350000,
    dataStatus: 'POTENTIAL_DUPLICATE',
    createdBy: editorId,
    updatedBy: editorId,
  }).run();

  // =========================================================================
  // LEVEL 1: SUPER_ADMIN TESTS
  // =========================================================================
  await t.test('Level 1: SUPER_ADMIN Role Permissions & Universal Access', async (st) => {
    await st.test('SUPER_ADMIN can list all system users (GET /api/users)', async () => {
      const res = await app.request('/api/users', { headers: getHeadersFor(superAdminToken) });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.users.length >= 6);
    });

    await st.test('SUPER_ADMIN can create a new system user (POST /api/users)', async () => {
      const res = await app.request('/api/users', {
        method: 'POST',
        headers: headersFor(superAdminToken, superAdminCsrf),
        body: JSON.stringify({
          name: 'New Test User Created By Admin',
          email: `new_user_${Date.now()}@test.com`,
          password: 'Password123!',
          systemRole: 'USER',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.user.id);
      createdUserId = data.user.id;
    });

    await st.test('SUPER_ADMIN can create a new financial group (POST /api/groups)', async () => {
      const res = await app.request('/api/groups', {
        method: 'POST',
        headers: headersFor(superAdminToken, superAdminCsrf),
        body: JSON.stringify({
          name: 'Created By Super Admin',
          slug: `grp-sa-${Date.now()}`,
          budgetLimit: 25000000,
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await st.test('SUPER_ADMIN can access global audit logs (GET /api/audit)', async () => {
      const res = await app.request('/api/audit', { headers: getHeadersFor(superAdminToken) });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.logs));
    });

    await st.test('SUPER_ADMIN has universal bypass on any group (Group A)', async () => {
      // Super admin can verify duplicate without explicit membership
      const res = await app.request(`/api/groups/${groupAId}/transactions/${txA1Id}/verify-duplicate`, {
        method: 'POST',
        headers: headersFor(superAdminToken, superAdminCsrf),
        body: JSON.stringify({ note: 'Super admin verified this duplicate manually' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify db update
      const tx = db.select().from(transactions).where(eq(transactions.id, txA1Id)).get();
      assert.strictEqual(tx?.dataStatus, 'VERIFIED_DUPLICATE_OK');
    });

    await st.test('SUPER_ADMIN cannot delete self (DELETE /api/users/:userId -> 400)', async () => {
      const res = await app.request(`/api/users/${superAdminId}`, {
        method: 'DELETE',
        headers: headersFor(superAdminToken, superAdminCsrf),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    await st.test('SUPER_ADMIN can delete another user (DELETE /api/users/:userId -> 200)', async () => {
      const res = await app.request(`/api/users/${createdUserId}`, {
        method: 'DELETE',
        headers: headersFor(superAdminToken, superAdminCsrf),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });
  });

  // =========================================================================
  // LEVEL 2: GROUP_MANAGER TESTS
  // =========================================================================
  await t.test('Level 2: GROUP_MANAGER Role Permissions & Boundary Checks', async (st) => {
    await st.test('GROUP_MANAGER can update group settings (PATCH /api/groups/:groupId)', async () => {
      const res = await app.request(`/api/groups/${groupAId}`, {
        method: 'PATCH',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({
          description: 'Updated description by group manager',
          budgetLimit: 120000000,
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      const updatedGroup = db.select().from(financialGroups).where(eq(financialGroups.id, groupAId)).get();
      assert.strictEqual(updatedGroup?.budgetLimit, 120000000);
    });

    await st.test('GROUP_MANAGER can add a category (POST /api/groups/:groupId/categories)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/categories`, {
        method: 'POST',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({
          name: 'Transportasi Panitia',
          type: 'EXPENSE',
          budgetAllocation: 10000000,
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.categoryId);
    });

    await st.test('GROUP_MANAGER can add custom units (POST /api/groups/:groupId/units)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/units`, {
        method: 'POST',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({ name: 'Galon' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await st.test('GROUP_MANAGER can manage group members (POST & PATCH & DELETE /api/groups/:groupId/members)', async () => {
      // Create a temporary user to add
      const tempUserId = uuidv4();
      db.insert(users).values({
        id: tempUserId,
        name: 'Temp Member Target',
        email: `temp_member_${Date.now()}@test.com`,
        passwordHash: 'dummy',
        systemRole: 'USER',
        isActive: 1,
      }).run();

      // 1. Add member as VIEWER
      const resAdd = await app.request(`/api/groups/${groupAId}/members`, {
        method: 'POST',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({
          userId: tempUserId,
          groupRole: 'VIEWER',
        }),
      });
      assert.strictEqual(resAdd.status, 200);

      // 2. Promote member to EDITOR
      const resPromote = await app.request(`/api/groups/${groupAId}/members/${tempUserId}`, {
        method: 'PATCH',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({ groupRole: 'EDITOR' }),
      });
      assert.strictEqual(resPromote.status, 200);

      // 3. Remove member
      const resRemove = await app.request(`/api/groups/${groupAId}/members/${tempUserId}`, {
        method: 'DELETE',
        headers: headersFor(managerToken, managerCsrf),
      });
      assert.strictEqual(resRemove.status, 200);

      db.delete(users).where(eq(users.id, tempUserId)).run();
    });

    await st.test('GROUP_MANAGER is FORBIDDEN from accessing system user management (403)', async () => {
      const resList = await app.request('/api/users', { headers: getHeadersFor(managerToken) });
      assert.strictEqual(resList.status, 403, 'GROUP_MANAGER must be blocked from /api/users');

      const resCreate = await app.request('/api/users', {
        method: 'POST',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({ name: 'Hack', email: 'hack@test.com', password: 'Password123!' }),
      });
      assert.strictEqual(resCreate.status, 403);
    });

    await st.test('GROUP_MANAGER is FORBIDDEN from creating new financial groups (403)', async () => {
      const res = await app.request('/api/groups', {
        method: 'POST',
        headers: headersFor(managerToken, managerCsrf),
        body: JSON.stringify({ name: 'Unauthorized Group', slug: `unauth-${Date.now()}` }),
      });
      assert.strictEqual(res.status, 403);
    });

    await st.test('GROUP_MANAGER is FORBIDDEN from accessing global audit logs (403)', async () => {
      const res = await app.request('/api/audit', { headers: getHeadersFor(managerToken) });
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // LEVEL 3: EDITOR TESTS
  // =========================================================================
  await t.test('Level 3: EDITOR Role Permissions & Boundary Checks', async (st) => {
    let editorCreatedTxId = '';

    await st.test('EDITOR can create a transaction (POST /api/groups/:groupId/transactions)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`, {
        method: 'POST',
        headers: headersFor(editorToken, editorCsrf),
        body: JSON.stringify({
          txDate: '2026-11-02',
          type: 'EXPENSE',
          description: 'Beli ATK Spidol & Whiteboard',
          categoryId: catAId,
          quantity: 4,
          unit: 'Pcs',
          unitPrice: 15000,
          calcMode: 'FORWARD',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.transaction.totalPrice, 60000);
      editorCreatedTxId = data.transaction.id;
    });

    await st.test('EDITOR can update a transaction (PATCH /api/groups/:groupId/transactions/:txId)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions/${editorCreatedTxId}`, {
        method: 'PATCH',
        headers: headersFor(editorToken, editorCsrf),
        body: JSON.stringify({
          description: 'Beli ATK Spidol Snowman & Whiteboard',
          unitPrice: 16000,
          quantity: 4,
          calcMode: 'FORWARD',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.transaction.totalPrice, 64000);
    });

    await st.test('EDITOR can delete a transaction (DELETE /api/groups/:groupId/transactions/:txId)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions/${editorCreatedTxId}`, {
        method: 'DELETE',
        headers: headersFor(editorToken, editorCsrf),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await st.test('EDITOR is FORBIDDEN from verifying duplicate transactions (403)', async () => {
      // Trying to verify txA1Id
      const res = await app.request(`/api/groups/${groupAId}/transactions/${txA1Id}/verify-duplicate`, {
        method: 'POST',
        headers: headersFor(editorToken, editorCsrf),
        body: JSON.stringify({ note: 'Editor trying to verify duplicate' }),
      });
      assert.strictEqual(res.status, 403, 'EDITOR must be denied from verifying duplicate');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('GROUP_MANAGER'));
    });

    await st.test('EDITOR is FORBIDDEN from updating group settings (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}`, {
        method: 'PATCH',
        headers: headersFor(editorToken, editorCsrf),
        body: JSON.stringify({ budgetLimit: 999999999 }),
      });
      assert.strictEqual(res.status, 403);
    });

    await st.test('EDITOR is FORBIDDEN from adding categories or members (403)', async () => {
      const resCat = await app.request(`/api/groups/${groupAId}/categories`, {
        method: 'POST',
        headers: headersFor(editorToken, editorCsrf),
        body: JSON.stringify({ name: 'Unauthorized Category' }),
      });
      assert.strictEqual(resCat.status, 403);

      const resMember = await app.request(`/api/groups/${groupAId}/members`, {
        method: 'POST',
        headers: headersFor(editorToken, editorCsrf),
        body: JSON.stringify({ userId: uuidv4(), groupRole: 'VIEWER' }),
      });
      assert.strictEqual(resMember.status, 403);
    });
  });

  // =========================================================================
  // LEVEL 4: VIEWER TESTS
  // =========================================================================
  await t.test('Level 4: VIEWER Role Permissions & Read-Only Enforcement', async (st) => {
    await st.test('VIEWER can read transactions (GET /api/groups/:groupId/transactions)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`, {
        headers: getHeadersFor(viewerToken),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.transactions));
    });

    await st.test('VIEWER can view analytics (GET /api/groups/:groupId/analytics)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/analytics`, {
        headers: getHeadersFor(viewerToken),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.kpis);
    });

    await st.test('VIEWER can export Excel report (GET /api/groups/:groupId/export)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/export`, {
        headers: getHeadersFor(viewerToken),
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    await st.test('VIEWER can view audit log feed (GET /api/groups/:groupId/audit)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/audit`, {
        headers: getHeadersFor(viewerToken),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await st.test('VIEWER is FORBIDDEN from creating a transaction (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`, {
        method: 'POST',
        headers: headersFor(viewerToken, viewerCsrf),
        body: JSON.stringify({
          txDate: '2026-11-03',
          type: 'EXPENSE',
          description: 'Viewer should fail',
          categoryId: catAId,
          quantity: 1,
          unit: 'Pcs',
          unitPrice: 10000,
        }),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('EDITOR'));
    });

    await st.test('VIEWER is FORBIDDEN from updating a transaction (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions/${txA1Id}`, {
        method: 'PATCH',
        headers: headersFor(viewerToken, viewerCsrf),
        body: JSON.stringify({ unitPrice: 99999 }),
      });
      assert.strictEqual(res.status, 403);
    });

    await st.test('VIEWER is FORBIDDEN from deleting a transaction (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions/${txA1Id}`, {
        method: 'DELETE',
        headers: headersFor(viewerToken, viewerCsrf),
      });
      assert.strictEqual(res.status, 403);
    });

    await st.test('VIEWER is FORBIDDEN from importing transactions (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/import/commit`, {
        method: 'POST',
        headers: headersFor(viewerToken, viewerCsrf),
        body: JSON.stringify({ rows: [] }),
      });
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // LEVEL 5: MULTI-TENANT BOUNDARY (NON_MEMBER & INACTIVE & UNAUTHENTICATED)
  // =========================================================================
  await t.test('Level 5: Multi-Tenant Isolation & Unauthenticated Security Checks', async (st) => {
    await st.test('NON_MEMBER (Manager of Group B) is FORBIDDEN from reading Group A (IDOR Protection 403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`, {
        headers: getHeadersFor(nonMemberToken),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('bukan anggota'));
    });

    await st.test('NON_MEMBER is FORBIDDEN from creating transactions in Group A (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`, {
        method: 'POST',
        headers: headersFor(nonMemberToken, nonMemberCsrf),
        body: JSON.stringify({
          txDate: '2026-11-03',
          type: 'EXPENSE',
          description: 'Cross-tenant injection attempt',
          categoryId: catAId,
          quantity: 1,
          unit: 'Pcs',
          unitPrice: 10000,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    await st.test('INACTIVE USER (isActive = 0) is REJECTED on any endpoint (403)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`, {
        headers: getHeadersFor(inactiveToken),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('dinonaktifkan'));
    });

    await st.test('UNAUTHENTICATED request without cookie is REJECTED (401)', async () => {
      const res = await app.request(`/api/groups/${groupAId}/transactions`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });
  });

  // Cleanup all fixtures
  const allUserIds = [superAdminId, managerId, editorId, viewerId, nonMemberId, inactiveId];
  if (createdUserId) allUserIds.push(createdUserId);

  db.delete(auditLogs).where(inArray(auditLogs.actorId, allUserIds)).run();
  db.delete(financialGroups).where(inArray(financialGroups.createdBy, allUserIds)).run();
  db.delete(users).where(inArray(users.id, allUserIds)).run();
});
