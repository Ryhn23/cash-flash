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
import { sqlite, DB_PATH } from './db/index.js';
import type { AppEnv } from './types/env.js';

const app = new Hono<AppEnv>();

// Performance profiling: Attach Server-Timing header to all responses
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const dur = (performance.now() - start).toFixed(2);
  c.header('Server-Timing', `total;dur=${dur}`);
});

// Global security headers (Strict CSP, frame deny, permissions policy)
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

// Enhanced Production Health & Readiness check
app.get('/api/health', (c) => {
  const dbStart = performance.now();
  let dbStatus = 'ok';
  let dbPingMs = 0;
  let dbSizeBytes = 0;

  try {
    sqlite.prepare('SELECT 1').get();
    dbPingMs = Number((performance.now() - dbStart).toFixed(2));
    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch {
    dbStatus = 'unhealthy';
  }

  const mem = process.memoryUsage();

  return c.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    service: 'next-cash-ledger',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      pingMs: dbPingMs,
      sizeMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
      journalMode: 'WAL',
    },
    system: {
      rssMb: Number((mem.rss / (1024 * 1024)).toFixed(1)),
      heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
    },
  });
});

// Serve frontend build if present in dist/client
const CLIENT_DIST = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(CLIENT_DIST)) {
  app.use('/*', serveStatic({ root: './dist/client' }));
  app.get('*', async (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ success: false, error: 'Endpoint API tidak ditemukan' }, 404);
    }
    const indexPath = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, 'utf-8'));
    }
    return c.text('Not Found', 404);
  });
}

const PORT = Number(process.env.PORT) || 3001;

console.log(`[Next-Cash] Server starting on http://localhost:${PORT}`);
const server = serve({
  fetch: app.fetch,
  port: PORT,
});

// Graceful shutdown handling for WAL checkpointing and clean DB closure
function handleShutdown(signal: string) {
  console.log(`\n[Next-Cash] Signal ${signal} received. Running checkpoint and shutting down...`);
  try {
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
    sqlite.pragma('optimize');
    sqlite.close();
    console.log('[Next-Cash] Database closed cleanly.');
  } catch (err) {
    console.error('[Next-Cash] Error during database shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
