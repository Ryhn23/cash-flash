import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { authMiddleware } from '../../server/src/middleware/auth.js';
import { requireGroupAccess, requireSuperAdmin } from '../../server/src/middleware/rbac.js';
import { csrfProtection } from '../../server/src/middleware/csrf.js';
import { rateLimit } from '../../server/src/middleware/rate-limit.js';
import { db } from '../../server/src/db/index.js';
import { users, sessions, financialGroups, groupMembers } from '../../server/src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashToken, generateSessionToken, generateCsrfToken } from '../../server/src/utils/security.js';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../../server/src/types/env.js';

test('Tahap 4: Security Middleware & Multi-Layer RBAC', async (t) => {
  // Test fixture setup
  const superAdminId = uuidv4();
  const managerId = uuidv4();
  const viewerId = uuidv4();
  const inactiveUserId = uuidv4();
  const testGroupId = uuidv4();

  const superAdminToken = generateSessionToken();
  const managerToken = generateSessionToken();
  const viewerToken = generateSessionToken();
  const inactiveToken = generateSessionToken();

  const managerCsrf = generateCsrfToken();

  // Create users
  db.insert(users).values([
    { id: superAdminId, name: 'Super Admin', email: `admin_${Date.now()}@test.com`, passwordHash: 'hash', systemRole: 'SUPER_ADMIN', isActive: 1 },
    { id: managerId, name: 'Manager User', email: `mgr_${Date.now()}@test.com`, passwordHash: 'hash', systemRole: 'USER', isActive: 1 },
    { id: viewerId, name: 'Viewer User', email: `view_${Date.now()}@test.com`, passwordHash: 'hash', systemRole: 'USER', isActive: 1 },
    { id: inactiveUserId, name: 'Inactive User', email: `inact_${Date.now()}@test.com`, passwordHash: 'hash', systemRole: 'USER', isActive: 0 },
  ]).run();

  // Create group
  db.insert(financialGroups).values({
    id: testGroupId,
    name: 'RBAC Test Group',
    slug: `rbac-test-${Date.now()}`,
    createdBy: superAdminId,
  }).run();

  // Add memberships
  db.insert(groupMembers).values([
    { id: uuidv4(), groupId: testGroupId, userId: managerId, groupRole: 'GROUP_MANAGER' },
    { id: uuidv4(), groupId: testGroupId, userId: viewerId, groupRole: 'VIEWER' },
  ]).run();

  const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();

  // Create sessions
  db.insert(sessions).values([
    { id: uuidv4(), userId: superAdminId, tokenHash: hashToken(superAdminToken), csrfToken: generateCsrfToken(), expiresAt: futureExpiry },
    { id: uuidv4(), userId: managerId, tokenHash: hashToken(managerToken), csrfToken: managerCsrf, expiresAt: futureExpiry },
    { id: uuidv4(), userId: viewerId, tokenHash: hashToken(viewerToken), csrfToken: generateCsrfToken(), expiresAt: futureExpiry },
    { id: uuidv4(), userId: inactiveUserId, tokenHash: hashToken(inactiveToken), csrfToken: generateCsrfToken(), expiresAt: futureExpiry },
  ]).run();

  await t.test('authMiddleware session validation', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authMiddleware);
    app.get('/protected', (c) => c.json({ ok: true, user: c.get('user') }));

    // 1. Missing cookie -> 401
    const resNoCookie = await app.request('/protected');
    assert.strictEqual(resNoCookie.status, 401);

    // 2. Invalid cookie token -> 401
    const resBadCookie = await app.request('/protected', {
      headers: { Cookie: 'nextcash_session=non-existent-token' },
    });
    assert.strictEqual(resBadCookie.status, 401);

    // 3. Inactive account -> 403
    const resInactive = await app.request('/protected', {
      headers: { Cookie: `nextcash_session=${inactiveToken}` },
    });
    assert.strictEqual(resInactive.status, 403);

    // 4. Valid active session -> 200
    const resValid = await app.request('/protected', {
      headers: { Cookie: `nextcash_session=${managerToken}` },
    });
    assert.strictEqual(resValid.status, 200);
    const body = await resValid.json();
    assert.strictEqual(body.user.id, managerId);
  });

  await t.test('csrfProtection middleware', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authMiddleware);
    app.use('*', csrfProtection);
    app.post('/mutate', (c) => c.json({ mutated: true }));

    // 1. Mutating request with missing x-csrf-token header -> 403
    const resMissingCsrf = await app.request('/mutate', {
      method: 'POST',
      headers: {
        Cookie: `nextcash_session=${managerToken}`,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
      },
    });
    assert.strictEqual(resMissingCsrf.status, 403);

    // 2. Mutating request with wrong x-csrf-token header -> 403
    const resWrongCsrf = await app.request('/mutate', {
      method: 'POST',
      headers: {
        Cookie: `nextcash_session=${managerToken}`,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': 'wrong-token',
      },
    });
    assert.strictEqual(resWrongCsrf.status, 403);

    // 3. Mutating request with correct x-csrf-token -> 200
    const resValidCsrf = await app.request('/mutate', {
      method: 'POST',
      headers: {
        Cookie: `nextcash_session=${managerToken}`,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': managerCsrf,
      },
    });
    assert.strictEqual(resValidCsrf.status, 200);
  });

  await t.test('requireGroupAccess & RBAC hierarchy', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authMiddleware);
    app.get('/groups/:groupId/view', requireGroupAccess('VIEWER'), (c) => c.json({ view: true }));
    app.post('/groups/:groupId/edit', requireGroupAccess('EDITOR'), (c) => c.json({ edit: true }));
    app.post('/groups/:groupId/manage', requireGroupAccess('GROUP_MANAGER'), (c) => c.json({ manage: true }));

    // 1. Viewer can view
    const resViewerView = await app.request(`/groups/${testGroupId}/view`, {
      headers: { Cookie: `nextcash_session=${viewerToken}` },
    });
    assert.strictEqual(resViewerView.status, 200);

    // 2. Viewer cannot edit (requires EDITOR, viewer is VIEWER) -> 403
    const resViewerEdit = await app.request(`/groups/${testGroupId}/edit`, {
      method: 'POST',
      headers: { Cookie: `nextcash_session=${viewerToken}` },
    });
    assert.strictEqual(resViewerEdit.status, 403);

    // 3. Manager can manage -> 200
    const resManagerManage = await app.request(`/groups/${testGroupId}/manage`, {
      method: 'POST',
      headers: { Cookie: `nextcash_session=${managerToken}` },
    });
    assert.strictEqual(resManagerManage.status, 200);

    // 4. SUPER_ADMIN can manage any group even without explicit membership -> 200
    const resSuperAdminManage = await app.request(`/groups/${testGroupId}/manage`, {
      method: 'POST',
      headers: { Cookie: `nextcash_session=${superAdminToken}` },
    });
    assert.strictEqual(resSuperAdminManage.status, 200);

    // 5. Non-existent group -> 404
    const resNonExistent = await app.request(`/groups/non-existent-group-id/view`, {
      headers: { Cookie: `nextcash_session=${managerToken}` },
    });
    assert.strictEqual(resNonExistent.status, 404);
  });

  await t.test('rateLimit middleware triggers 429 when max is exceeded', async () => {
    const app = new Hono<AppEnv>();
    app.use(
      '/limited',
      rateLimit({
        storeName: 'test-limiter',
        max: 3,
        windowMs: 10000,
        keyGenerator: () => 'fixed-test-client',
      })
    );
    app.get('/limited', (c) => c.text('ok'));

    const r1 = await app.request('/limited');
    assert.strictEqual(r1.status, 200);
    const r2 = await app.request('/limited');
    assert.strictEqual(r2.status, 200);
    const r3 = await app.request('/limited');
    assert.strictEqual(r3.status, 200);

    // 4th request exceeds max: 3 -> 429
    const r4 = await app.request('/limited');
    assert.strictEqual(r4.status, 429);
    assert.ok(r4.headers.get('retry-after'), 'Retry-After header must be set');
  });

  // Cleanup test fixtures
  db.delete(financialGroups).where(eq(financialGroups.id, testGroupId)).run();
  db.delete(users).where(eq(users.id, superAdminId)).run();
  db.delete(users).where(eq(users.id, managerId)).run();
  db.delete(users).where(eq(users.id, viewerId)).run();
  db.delete(users).where(eq(users.id, inactiveUserId)).run();
});
