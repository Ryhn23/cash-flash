import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  financialGroups,
  groupCategories,
  transactions,
  users,
  type FinancialGroup,
} from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireGroupAccess } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { recordAuditLog } from '../services/audit.js';
import {
  generateSafirExcelWorkbook,
  parseAndValidateExcel,
  commitImportedRows,
  type ExportTransactionData,
} from '../services/excel.js';
import type { AppEnv } from '../types/env.js';

export const excelRouter = new Hono<AppEnv>();

excelRouter.use('*', authMiddleware);

// Rate limit import: max 10 imports per hour
const importRateLimiter = rateLimit({
  storeName: 'import',
  max: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (c) => {
    const user = c.get('user');
    return user ? user.id : 'unknown';
  },
  message: 'Batas kuota import terlampaui (maksimal 10x per jam). Silakan coba lagi nanti.',
});

// GET /api/groups/:groupId/export - Download Safir formatted Excel workbook
excelRouter.get('/:groupId/export', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');
  const group = c.get('group') as FinancialGroup;

  // Fetch transactions
  const txList = db
    .select({
      id: transactions.id,
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
      creatorName: users.name,
      verificationNote: transactions.verificationNote,
    })
    .from(transactions)
    .leftJoin(groupCategories, eq(transactions.categoryId, groupCategories.id))
    .innerJoin(users, eq(transactions.createdBy, users.id))
    .where(eq(transactions.groupId, groupId))
    .orderBy(transactions.txDate, transactions.createdAt)
    .all();

  // Fetch categories
  const catList = db
    .select({
      name: groupCategories.name,
      budgetAllocation: groupCategories.budgetAllocation,
    })
    .from(groupCategories)
    .where(eq(groupCategories.groupId, groupId))
    .all();

  const exportData: ExportTransactionData[] = txList.map((t) => ({
    id: t.id,
    txDate: t.txDate,
    type: t.type,
    description: t.description,
    categoryName: t.categoryName || 'Belum dikategorikan',
    quantity: t.quantity,
    unit: t.unit,
    unitPrice: t.unitPrice,
    totalPrice: t.totalPrice,
    dataStatus: t.dataStatus,
    creatorName: t.creatorName,
    verificationNote: t.verificationNote,
  }));

  const excelBuffer = await generateSafirExcelWorkbook(group.name, exportData, catList);

  const safeFilename = `BELANJA_${group.slug.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;

  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', `attachment; filename="${safeFilename}"`);

  return c.body(excelBuffer as any);
});

// POST /api/groups/:groupId/import/preview - Dry-run validation report
excelRouter.post(
  '/:groupId/import/preview',
  requireGroupAccess('EDITOR'),
  importRateLimiter,
  async (c) => {
    const groupId = c.req.param('groupId');
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ success: false, error: 'Berkas Excel (.xlsx / .csv) tidak ditemukan' }, 400);
    }

    const fileBuffer = Buffer.from(await (file as File).arrayBuffer());

    const categories = db
      .select({ id: groupCategories.id, name: groupCategories.name })
      .from(groupCategories)
      .where(eq(groupCategories.groupId, groupId))
      .all();

    try {
      const report = await parseAndValidateExcel(fileBuffer, groupId, categories);
      return c.json({ success: true, report });
    } catch (err: any) {
      return c.json({ success: false, error: err.message || 'Gagal memproses berkas Excel' }, 400);
    }
  }
);

// POST /api/groups/:groupId/import/commit - Batch commit valid rows
excelRouter.post(
  '/:groupId/import/commit',
  requireGroupAccess('EDITOR'),
  zValidator(
    'json',
    z.object({
      rows: z.array(
        z.object({
          txDate: z.string(),
          description: z.string(),
          categoryId: z.string().uuid().nullable().optional(),
          quantity: z.number().positive(),
          unit: z.string(),
          unitPrice: z.number().nonnegative(),
          totalPrice: z.number().int().nonnegative(),
          type: z.enum(['EXPENSE', 'INCOME']).default('EXPENSE'),
          note: z.string().optional(),
        })
      ),
    })
  ),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const { rows } = c.req.valid('json');

    if (rows.length === 0) {
      return c.json({ success: false, error: 'Tidak ada baris yang valid untuk diimpor' }, 400);
    }

    const insertedCount = await commitImportedRows(groupId, actor.id, rows as any);

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'IMPORT_EXCEL_TRANSACTIONS',
      entityType: 'TRANSACTION_BATCH',
      entityId: groupId,
      newValues: { rowCount: insertedCount },
    });

    return c.json({
      success: true,
      message: `Berhasil mengimpor ${insertedCount} transaksi`,
      insertedCount,
    });
  }
);
