import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions, groupMembers } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { getReceiptAbsolutePath } from '../services/upload.js';
import type { AppEnv } from '../types/env.js';

export const receiptsRouter = new Hono<AppEnv>();

// GET /uploads/:filename - Secure receipt file serving with tenant boundary check
receiptsRouter.get('/:filename', authMiddleware, async (c) => {
  const user = c.get('user');
  const filename = c.req.param('filename');
  const safePath = getReceiptAbsolutePath(filename);
  if (!safePath) {
    return c.json({ success: false, error: 'Berkas tidak ditemukan' }, 404);
  }

  // Enforce tenant authorization: Super Admin can access all; members only their group's receipts
  if (user.systemRole !== 'SUPER_ADMIN') {
    const tx = db
      .select({ groupId: transactions.groupId })
      .from(transactions)
      .where(eq(transactions.receiptPath, filename))
      .get();

    if (!tx) {
      return c.json({ success: false, error: 'Akses ditolak: Dokumen tidak terikat pada transaksi' }, 403);
    }

    const membership = db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, tx.groupId), eq(groupMembers.userId, user.id)))
      .get();

    if (!membership) {
      return c.json({ success: false, error: 'Akses ditolak: Anda tidak memiliki akses ke berkas grup ini' }, 403);
    }
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
  c.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  const fileStream = fs.createReadStream(safePath);
  return c.body(fileStream as any);
});

