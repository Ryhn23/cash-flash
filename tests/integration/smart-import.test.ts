import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { authRouter } from '../../server/src/routes/auth.js';
import { groupsRouter } from '../../server/src/routes/groups.js';
import { smartImportRouter } from '../../server/src/routes/smart-import.js';
import { db } from '../../server/src/db/index.js';
import { users, sessions, financialGroups, groupMembers } from '../../server/src/db/schema.js';
import { hashPassword, hashToken, generateSessionToken, generateCsrfToken } from '../../server/src/utils/security.js';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../../server/src/types/env.js';

function createSmartImportApp() {
  const app = new Hono<AppEnv>();
  app.route('/api/auth', authRouter);
  app.route('/api/groups', groupsRouter);
  app.route('/api/groups', smartImportRouter);
  return app;
}

test('Smart Import Integration Tests (Scan, Authorization & Validation)', async (t) => {
  const app = createSmartImportApp();

  // Seed test users: 1 Editor and 1 Viewer
  const editorId = uuidv4();
  const editorEmail = `editor_scan_${Date.now()}@test.com`;
  const viewerId = uuidv4();
  const viewerEmail = `viewer_scan_${Date.now()}@test.com`;
  const passwordHash = await hashPassword('Password123!');

  db.insert(users)
    .values([
      { id: editorId, name: 'Editor Scan', email: editorEmail, passwordHash, systemRole: 'USER', isActive: 1 },
      { id: viewerId, name: 'Viewer Scan', email: viewerEmail, passwordHash, systemRole: 'USER', isActive: 1 },
    ])
    .run();

  // Create financial group
  const groupId = uuidv4();
  db.insert(financialGroups)
    .values({
      id: groupId,
      name: 'Smart Scan Test Group',
      slug: `scan-group-${Date.now()}`,
      createdBy: editorId,
      budgetLimit: 50000000,
    })
    .run();

  // Link memberships
  db.insert(groupMembers)
    .values([
      { id: uuidv4(), groupId, userId: editorId, groupRole: 'EDITOR' },
      { id: uuidv4(), groupId, userId: viewerId, groupRole: 'VIEWER' },
    ])
    .run();

  // Create session for Editor
  const editorRawToken = generateSessionToken();
  const editorCsrfToken = generateCsrfToken();
  db.insert(sessions)
    .values({
      id: uuidv4(),
      userId: editorId,
      tokenHash: hashToken(editorRawToken),
      csrfToken: editorCsrfToken,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    .run();
  const editorCookie = `nextcash_session=${editorRawToken}`;

  // Create session for Viewer
  const viewerRawToken = generateSessionToken();
  const viewerCsrfToken = generateCsrfToken();
  db.insert(sessions)
    .values({
      id: uuidv4(),
      userId: viewerId,
      tokenHash: hashToken(viewerRawToken),
      csrfToken: viewerCsrfToken,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    .run();
  const viewerCookie = `nextcash_session=${viewerRawToken}`;

  await t.test('EDITOR can scan valid PNG receipt and receive detected data + saved receiptPath', async () => {
    // Valid 1x1 pixel PNG bytes
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const pngBuffer = Buffer.from(pngBase64, 'base64');
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'receipt.png');

    const res = await app.request(`/api/groups/${groupId}/smart-import/scan`, {
      method: 'POST',
      headers: {
        Cookie: editorCookie,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': editorCsrfToken,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.receiptPath);
    assert.ok(body.detected);
    assert.ok(body.detected.txDate);
    assert.strictEqual(typeof body.detected.totalPrice, 'number');
  });

  await t.test('Invalid file format (plain text / fake extension) is rejected with 400', async () => {
    const fakeBlob = new Blob(['Ini bukan gambar asli'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', fakeBlob, 'nota.png');

    const res = await app.request(`/api/groups/${groupId}/smart-import/scan`, {
      method: 'POST',
      headers: {
        Cookie: editorCookie,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': editorCsrfToken,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Format berkas tidak didukung'));
  });

  await t.test('VIEWER role is FORBIDDEN from scanning invoices (403)', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'receipt.png');

    const res = await app.request(`/api/groups/${groupId}/smart-import/scan`, {
      method: 'POST',
      headers: {
        Cookie: viewerCookie,
        Host: 'localhost:3001',
        Origin: 'http://localhost:3001',
        'x-csrf-token': viewerCsrfToken,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 403);
  });

  await t.test('Unauthenticated request is REJECTED with 401', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'receipt.png');

    const res = await app.request(`/api/groups/${groupId}/smart-import/scan`, {
      method: 'POST',
      body: formData,
    });

    assert.strictEqual(res.status, 401);
  });
});
