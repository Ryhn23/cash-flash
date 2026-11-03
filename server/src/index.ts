import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'node:path';
import fs from 'node:fs';

import { securityHeadersMiddleware, payloadLimitMiddleware } from './middleware/security.js';
import { csrfProtection } from './middleware/csrf.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { groupsRouter } from './routes/groups.js';
import { transactionsRouter } from './routes/transactions.js';
import { excelRouter } from './routes/excel.js';
import { analyticsRouter } from './routes/analytics.js';
import { auditRouter } from './routes/audit.js';
import { getReceiptAbsolutePath } from './services/upload.js';
import type { AppEnv } from './types/env.js';

const app = new Hono<AppEnv>();

// Global security headers (Strict CSP, frame deny, etc.)
app.use('*', securityHeadersMiddleware);

// Payload limit (Max 5MB)
app.use('*', payloadLimitMiddleware);

// CSRF double submit / session-bound token defense
app.use('*', csrfProtection);

// Safe receipt file serving
app.get('/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');
  const safePath = getReceiptAbsolutePath(filename);
  if (!safePath) {
    return c.json({ success: false, error: 'Berkas tidak ditemukan' }, 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  c.header('Content-Type', contentType);
  c.header('Content-Disposition', `inline; filename="${path.basename(filename)}"`);

  const fileStream = fs.createReadStream(safePath);
  return c.body(fileStream as any);
});

// Mount API routes
app.route('/api/auth', authRouter);
app.route('/api/users', usersRouter);
app.route('/api/groups', groupsRouter);
app.route('/api/groups', transactionsRouter);
app.route('/api/groups', excelRouter);
app.route('/api/groups', analyticsRouter);
app.route('/api/groups', auditRouter);
app.route('/api/audit', auditRouter);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'next-cash-ledger', timestamp: new Date().toISOString() });
});

// Serve frontend build if present in dist/client
const CLIENT_DIST = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(CLIENT_DIST)) {
  app.use('/*', serveStatic({ root: './dist/client' }));
  app.get('*', async (c) => {
    const indexPath = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, 'utf-8'));
    }
    return c.text('Not Found', 404);
  });
}

const PORT = Number(process.env.PORT) || 3001;

console.log(`[Next-Cash] Server starting on http://localhost:${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
});
