import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  transactions,
  groupCategories,
  users,
  type Transaction,
} from '../db/schema.js';
import { stripHtml } from '../utils/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireGroupAccess } from '../middleware/rbac.js';
import { recordAuditLog } from '../services/audit.js';
import { recalculateGroupAnomalies } from '../services/anomaly.js';
import { saveUploadedReceipt, getReceiptAbsolutePath } from '../services/upload.js';
import fs from 'node:fs';
import type { AppEnv } from '../types/env.js';

export const transactionsRouter = new Hono<AppEnv>();

transactionsRouter.use('*', authMiddleware);

// Transaction creation / update schema
const transactionInputSchema = z.object({
  txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  type: z.enum(['EXPENSE', 'INCOME']).default('EXPENSE'),
  description: z.string().trim().min(1, 'Uraian wajib diisi').transform(stripHtml),
  categoryId: z.string().uuid().nullable().optional(),
  quantity: z.number().positive('Jumlah harus lebih dari 0'),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').transform(stripHtml),
  unitPrice: z.number().min(0, 'Harga satuan tidak boleh negatif').optional(),
  totalPrice: z.number().int().min(0, 'Total harga tidak boleh negatif').optional(),
  calcMode: z.enum(['FORWARD', 'REVERSE']).default('FORWARD'),
  verificationNote: z.string().trim().transform(stripHtml).optional(),
});

// GET /api/groups/:groupId/transactions - List transactions with filters
transactionsRouter.get('/:groupId/transactions', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');
  const { categoryId, status, type, search, startDate, endDate } = c.req.query();

  // Query transactions with creator & category
  let query = db
    .select({
      id: transactions.id,
      groupId: transactions.groupId,
      txDate: transactions.txDate,
      type: transactions.type,
      description: transactions.description,
      categoryId: transactions.categoryId,
      categoryName: groupCategories.name,
      quantity: transactions.quantity,
      unit: transactions.unit,
      unitPrice: transactions.unitPrice,
      totalPrice: transactions.totalPrice,
      dataStatus: transactions.dataStatus,
      verificationNote: transactions.verificationNote,
      verifiedBy: transactions.verifiedBy,
      receiptPath: transactions.receiptPath,
      createdBy: transactions.createdBy,
      creatorName: users.name,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
    })
    .from(transactions)
    .leftJoin(groupCategories, eq(transactions.categoryId, groupCategories.id))
    .innerJoin(users, eq(transactions.createdBy, users.id))
    .where(eq(transactions.groupId, groupId));

  const allList = query.orderBy(desc(transactions.txDate), desc(transactions.createdAt)).all();

  // Apply filters
  let filtered = allList;

  if (categoryId) {
    if (categoryId === 'uncategorized') {
      filtered = filtered.filter((t) => !t.categoryId);
    } else {
      filtered = filtered.filter((t) => t.categoryId === categoryId);
    }
  }

  if (status) {
    filtered = filtered.filter((t) => t.dataStatus === status);
  }

  if (type) {
    filtered = filtered.filter((t) => t.type === type);
  }

  if (startDate) {
    filtered = filtered.filter((t) => t.txDate >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((t) => t.txDate <= endDate);
  }

  if (search) {
    const kw = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.description.toLowerCase().includes(kw) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(kw)) ||
        (t.verificationNote && t.verificationNote.toLowerCase().includes(kw))
    );
  }

  return c.json({
    success: true,
    total: filtered.length,
    transactions: filtered,
  });
});

// POST /api/groups/:groupId/transactions - Create transaction (EDITOR / GROUP_MANAGER)
transactionsRouter.post(
  '/:groupId/transactions',
  requireGroupAccess('EDITOR'),
  zValidator('json', transactionInputSchema),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const body = c.req.valid('json');

    // Dual-Direction Auto-Calculation:
    let quantity = body.quantity;
    let unitPrice = body.unitPrice || 0;
    let totalPrice = body.totalPrice || 0;

    if (body.calcMode === 'REVERSE' && totalPrice > 0) {
      // Mode B (Reverse Split from Receipt Total):
      // Exact integer Total Harga preserved, Harga Satuan computed
      unitPrice = totalPrice / quantity;
    } else {
      // Mode A (Default Forward):
      // Input Qty & Unit Price -> compute rounded Total Harga
      totalPrice = Math.round(quantity * unitPrice);
    }

    const id = uuidv4();

    db.insert(transactions)
      .values({
        id,
        groupId,
        txDate: body.txDate,
        type: body.type,
        description: body.description,
        categoryId: body.categoryId || null,
        quantity,
        unit: body.unit,
        unitPrice,
        totalPrice,
        dataStatus: 'OK',
        verificationNote: body.verificationNote || null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .run();

    // Trigger Anomaly Detection Engine
    recalculateGroupAnomalies(groupId);

    const inserted = db.select().from(transactions).where(eq(transactions.id, id)).get();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'CREATE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: id,
      newValues: {
        txDate: body.txDate,
        description: body.description,
        totalPrice,
        categoryId: body.categoryId,
      },
    });

    return c.json({ success: true, transaction: inserted });
  }
);

// PATCH /api/groups/:groupId/transactions/:txId - Update transaction (EDITOR)
transactionsRouter.patch(
  '/:groupId/transactions/:txId',
  requireGroupAccess('EDITOR'),
  zValidator('json', transactionInputSchema.partial()),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const txId = c.req.param('txId');
    const body = c.req.valid('json');

    // Strict IDOR Check: query WHERE id = :txId AND group_id = :verifiedGroupId
    const currentTx = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
      .get();

    if (!currentTx) {
      return c.json({ success: false, error: 'Transaksi tidak ditemukan pada grup ini' }, 404);
    }

    let quantity = body.quantity !== undefined ? body.quantity : currentTx.quantity;
    let unitPrice = body.unitPrice !== undefined ? body.unitPrice : currentTx.unitPrice;
    let totalPrice = body.totalPrice !== undefined ? body.totalPrice : currentTx.totalPrice;

    if (body.calcMode === 'REVERSE' && body.totalPrice !== undefined) {
      totalPrice = Math.round(body.totalPrice);
      unitPrice = totalPrice / quantity;
    } else if (body.unitPrice !== undefined || body.quantity !== undefined) {
      totalPrice = Math.round(quantity * unitPrice);
    }

    const setValues: Record<string, unknown> = {
      updatedBy: actor.id,
      updatedAt: new Date().toISOString(),
      quantity,
      unitPrice,
      totalPrice,
    };

    if (body.txDate) setValues.txDate = body.txDate;
    if (body.type) setValues.type = body.type;
    if (body.description) setValues.description = body.description;
    if (body.categoryId !== undefined) setValues.categoryId = body.categoryId;
    if (body.unit) setValues.unit = body.unit;
    if (body.verificationNote !== undefined) setValues.verificationNote = body.verificationNote;

    db.update(transactions)
      .set(setValues)
      .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
      .run();

    // Re-evaluate group anomalies
    recalculateGroupAnomalies(groupId);

    const updated = db.select().from(transactions).where(eq(transactions.id, txId)).get();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'UPDATE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: txId,
      oldValues: {
        description: currentTx.description,
        totalPrice: currentTx.totalPrice,
        txDate: currentTx.txDate,
      },
      newValues: setValues,
    });

    return c.json({ success: true, transaction: updated });
  }
);

// DELETE /api/groups/:groupId/transactions/:txId - Delete transaction (EDITOR / GROUP_MANAGER)
transactionsRouter.delete('/:groupId/transactions/:txId', requireGroupAccess('EDITOR'), async (c) => {
  const actor = c.get('user');
  const groupId = c.req.param('groupId');
  const txId = c.req.param('txId');

  // Strict IDOR Check
  const currentTx = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
    .get();

  if (!currentTx) {
    return c.json({ success: false, error: 'Transaksi tidak ditemukan pada grup ini' }, 404);
  }

  db.delete(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
    .run();

  // Re-evaluate anomalies for remaining group transactions (reverts duplicates to OK if only 1 remains!)
  recalculateGroupAnomalies(groupId);

  recordAuditLog({
    groupId,
    actorId: actor.id,
    action: 'DELETE_TRANSACTION',
    entityType: 'TRANSACTION',
    entityId: txId,
    oldValues: {
      description: currentTx.description,
      totalPrice: currentTx.totalPrice,
      txDate: currentTx.txDate,
    },
  });

  return c.json({ success: true, message: 'Transaksi berhasil dihapus' });
});

// POST /api/groups/:groupId/transactions/:txId/verify-duplicate - Confirm not duplicate (GROUP_MANAGER)
transactionsRouter.post(
  '/:groupId/transactions/:txId/verify-duplicate',
  requireGroupAccess('GROUP_MANAGER'),
  zValidator(
    'json',
    z.object({
      note: z.string().trim().min(3, 'Catatan verifikasi wajib diisi (minimal 3 karakter)').transform(stripHtml),
    })
  ),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const txId = c.req.param('txId');
    const { note } = c.req.valid('json');

    // Strict IDOR Check
    const targetTx = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
      .get();

    if (!targetTx) {
      return c.json({ success: false, error: 'Transaksi tidak ditemukan pada grup ini' }, 404);
    }

    db.update(transactions)
      .set({
        dataStatus: 'VERIFIED_DUPLICATE_OK',
        verificationNote: note,
        verifiedBy: actor.id,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
      .run();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'VERIFY_DUPLICATE_OK',
      entityType: 'TRANSACTION',
      entityId: txId,
      newValues: { verificationNote: note, verifiedBy: actor.id },
    });

    return c.json({
      success: true,
      message: 'Transaksi berhasil diverifikasi sebagai bukan dobel',
    });
  }
);

// POST /api/groups/:groupId/transactions/:txId/receipt - Upload receipt (EDITOR)
transactionsRouter.post('/:groupId/transactions/:txId/receipt', requireGroupAccess('EDITOR'), async (c) => {
  const actor = c.get('user');
  const groupId = c.req.param('groupId');
  const txId = c.req.param('txId');

  // Strict IDOR Check
  const targetTx = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
    .get();

  if (!targetTx) {
    return c.json({ success: false, error: 'Transaksi tidak ditemukan pada grup ini' }, 404);
  }

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ success: false, error: 'File nota/lampiran tidak ditemukan' }, 400);
  }

  const fileBuffer = Buffer.from(await (file as File).arrayBuffer());

  try {
    const savedFilename = await saveUploadedReceipt(fileBuffer);

    db.update(transactions)
      .set({
        receiptPath: savedFilename,
        updatedBy: actor.id,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transactions.id, txId), eq(transactions.groupId, groupId)))
      .run();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'UPLOAD_RECEIPT',
      entityType: 'TRANSACTION',
      entityId: txId,
      newValues: { receiptPath: savedFilename },
    });

    return c.json({
      success: true,
      receiptPath: savedFilename,
      url: `/uploads/${savedFilename}`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Gagal mengunggah lampiran' }, 400);
  }
});
