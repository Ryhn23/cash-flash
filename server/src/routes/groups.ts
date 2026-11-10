import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import { db } from '../db/index.js';
import {
  financialGroups,
  groupMembers,
  groupCategories,
  groupUnits,
  users,
  transactions,
  type FinancialGroup,
} from '../db/schema.js';
import { stripHtml } from '../utils/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuperAdmin, requireGroupAccess } from '../middleware/rbac.js';
import { recordAuditLog } from '../services/audit.js';
import { getReceiptAbsolutePath } from '../services/upload.js';
import type { AppEnv } from '../types/env.js';

export const groupsRouter = new Hono<AppEnv>();

groupsRouter.use('*', authMiddleware);

const DEFAULT_CATEGORIES = [
  'Tempat Tinggal',
  'Kantor',
  'Perlengkapan',
  'Elektronik',
  'Listrik',
  'Transportasi',
  'Tiket',
  'Coffee Break',
  'Snack',
  'Lainnya',
];

const DEFAULT_UNITS = ['Unit', 'Paket', 'Pcs', 'Lusin', 'Liter', 'Kg'];

// Schema for group creation
const createGroupSchema = z.object({
  name: z.string().trim().min(3, 'Nama grup minimal 3 karakter').transform(stripHtml),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .transform((val) => stripHtml(val).toLowerCase()),
  description: z.string().trim().optional().transform((val) => (val ? stripHtml(val) : '')),
  budgetLimit: z.number().int().min(0).default(0),
});

// GET /api/groups - List all groups user has access to
groupsRouter.get('/', async (c) => {
  const user = c.get('user');

  let list: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    budgetLimit: number;
    isArchived: number;
    userRole: string;
    memberCount: number;
    transactionCount: number;
  }> = [];

  if (user.systemRole === 'SUPER_ADMIN') {
    const all = db.select().from(financialGroups).orderBy(desc(financialGroups.createdAt)).all();
    list = all.map((g) => {
      const memberCount = db
        .select({ count: groupMembers.id })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, g.id))
        .all().length;

      const txCount = db
        .select({ count: transactions.id })
        .from(transactions)
        .where(eq(transactions.groupId, g.id))
        .all().length;

      return {
        ...g,
        userRole: 'GROUP_MANAGER',
        memberCount,
        transactionCount: txCount,
      };
    });
  } else {
    const memberships = db
      .select({
        group: financialGroups,
        role: groupMembers.groupRole,
      })
      .from(groupMembers)
      .innerJoin(financialGroups, eq(groupMembers.groupId, financialGroups.id))
      .where(eq(groupMembers.userId, user.id))
      .all();

    list = memberships.map((m) => {
      const memberCount = db
        .select({ count: groupMembers.id })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, m.group.id))
        .all().length;

      const txCount = db
        .select({ count: transactions.id })
        .from(transactions)
        .where(eq(transactions.groupId, m.group.id))
        .all().length;

      return {
        ...m.group,
        userRole: m.role,
        memberCount,
        transactionCount: txCount,
      };
    });
  }

  return c.json({ success: true, groups: list });
});

// POST /api/groups - Create financial group (SUPER_ADMIN only)
groupsRouter.post('/', requireSuperAdmin, zValidator('json', createGroupSchema), async (c) => {
  const actor = c.get('user');
  const { name, slug, description, budgetLimit } = c.req.valid('json');

  const existingSlug = db.select().from(financialGroups).where(eq(financialGroups.slug, slug)).get();
  if (existingSlug) {
    return c.json({ success: false, error: 'Slug sudah digunakan oleh grup lain' }, 400);
  }

  const groupId = uuidv4();

  db.transaction((tx) => {
    // 1. Insert group
    tx.insert(financialGroups)
      .values({
        id: groupId,
        name,
        slug,
        description,
        budgetLimit,
        createdBy: actor.id,
      })
      .run();

    // 2. Assign creator as GROUP_MANAGER
    tx.insert(groupMembers)
      .values({
        id: uuidv4(),
        groupId,
        userId: actor.id,
        groupRole: 'GROUP_MANAGER',
      })
      .run();

    // 3. Populate default categories
    for (const catName of DEFAULT_CATEGORIES) {
      tx.insert(groupCategories)
        .values({
          id: uuidv4(),
          groupId,
          name: catName,
          type: 'EXPENSE',
          budgetAllocation: 0,
        })
        .run();
    }

    // 4. Populate default units
    for (const u of DEFAULT_UNITS) {
      tx.insert(groupUnits)
        .values({
          id: uuidv4(),
          groupId,
          name: u,
        })
        .run();
    }
  });

  recordAuditLog({
    groupId,
    actorId: actor.id,
    action: 'CREATE_GROUP',
    entityType: 'GROUP',
    entityId: groupId,
    newValues: { name, slug, budgetLimit },
  });

  return c.json({ success: true, groupId });
});

// GET /api/groups/:groupId - Group details
groupsRouter.get('/:groupId', requireGroupAccess('VIEWER'), async (c) => {
  const group = c.get('group') as FinancialGroup;
  const userRole = c.get('groupRole');

  return c.json({
    success: true,
    group: {
      ...group,
      userRole,
    },
  });
});

// PATCH /api/groups/:groupId - Update group settings (GROUP_MANAGER / SUPER_ADMIN)
groupsRouter.patch(
  '/:groupId',
  requireGroupAccess('GROUP_MANAGER'),
  zValidator(
    'json',
    z.object({
      name: z.string().trim().min(2).transform(stripHtml).optional(),
      slug: z
        .string()
        .trim()
        .min(2)
        .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
        .transform((val) => stripHtml(val).toLowerCase())
        .optional(),
      description: z.string().trim().transform(stripHtml).optional(),
      budgetLimit: z.number().int().min(0).optional(),
      isArchived: z.number().int().min(0).max(1).optional(),
    })
  ),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const updates = c.req.valid('json');

    const group = db.select().from(financialGroups).where(eq(financialGroups.id, groupId)).get();
    if (!group) return c.json({ success: false, error: 'Grup tidak ditemukan' }, 404);

    if (updates.slug && updates.slug !== group.slug) {
      const existing = db.select().from(financialGroups).where(eq(financialGroups.slug, updates.slug)).get();
      if (existing) {
        return c.json({ success: false, error: 'Slug sudah digunakan oleh grup lain' }, 400);
      }
    }

    db.update(financialGroups).set(updates).where(eq(financialGroups.id, groupId)).run();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'UPDATE_GROUP',
      entityType: 'GROUP',
      entityId: groupId,
      oldValues: { name: group.name, slug: group.slug, budgetLimit: group.budgetLimit, isArchived: group.isArchived },
      newValues: updates,
    });

    return c.json({ success: true, message: 'Pengaturan grup berhasil diperbarui' });
  }
);

// DELETE /api/groups/:groupId - Permanently delete financial group (SUPER_ADMIN only)
groupsRouter.delete('/:groupId', requireSuperAdmin, async (c) => {
  const actor = c.get('user');
  const groupId = c.req.param('groupId');

  const group = db.select().from(financialGroups).where(eq(financialGroups.id, groupId)).get();
  if (!group) {
    return c.json({ success: false, error: 'Grup keuangan tidak ditemukan' }, 404);
  }

  try {
    // 1. Delete associated uploaded receipt files from disk
    const groupTxs = db
      .select({ receiptPath: transactions.receiptPath })
      .from(transactions)
      .where(eq(transactions.groupId, groupId))
      .all();

    for (const tx of groupTxs) {
      if (tx.receiptPath) {
        const fullPath = getReceiptAbsolutePath(tx.receiptPath);
        if (fullPath && fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {
            // Ignore file unlink error
          }
        }
      }
    }

    // 2. Cascade delete from database
    db.transaction((tx) => {
      tx.delete(financialGroups).where(eq(financialGroups.id, groupId)).run();
    });

    // Record audit log with groupId: null so it survives in global audit logs
    recordAuditLog({
      groupId: null,
      actorId: actor.id,
      action: 'DELETE_GROUP',
      entityType: 'GROUP',
      entityId: groupId,
      oldValues: { name: group.name, slug: group.slug, budgetLimit: group.budgetLimit },
    });

    return c.json({ success: true, message: 'Grup keuangan beserta seluruh data terkait berhasil dihapus secara permanen' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Gagal menghapus grup keuangan' }, 500);
  }
});

// GET /api/groups/:groupId/members
groupsRouter.get('/:groupId/members', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');

  const members = db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      groupRole: groupMembers.groupRole,
      joinedAt: groupMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .all();

  return c.json({ success: true, members });
});

// POST /api/groups/:groupId/members - Add member (GROUP_MANAGER)
groupsRouter.post(
  '/:groupId/members',
  requireGroupAccess('GROUP_MANAGER'),
  zValidator(
    'json',
    z.object({
      userId: z.string().uuid(),
      groupRole: z.enum(['GROUP_MANAGER', 'EDITOR', 'VIEWER']),
    })
  ),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const { userId, groupRole } = c.req.valid('json');

    const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
    if (!targetUser) {
      return c.json({ success: false, error: 'Pengguna tidak ditemukan' }, 404);
    }

    const existingMember = db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .get();

    if (existingMember) {
      return c.json({ success: false, error: 'Pengguna sudah menjadi anggota grup ini' }, 400);
    }

    const memberId = uuidv4();
    db.insert(groupMembers)
      .values({
        id: memberId,
        groupId,
        userId,
        groupRole,
      })
      .run();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'ADD_GROUP_MEMBER',
      entityType: 'MEMBER',
      entityId: memberId,
      newValues: { userId, userEmail: targetUser.email, groupRole },
    });

    return c.json({ success: true, memberId });
  }
);

// PATCH /api/groups/:groupId/members/:userId - Update member role (GROUP_MANAGER)
groupsRouter.patch(
  '/:groupId/members/:userId',
  requireGroupAccess('GROUP_MANAGER'),
  zValidator(
    'json',
    z.object({
      groupRole: z.enum(['GROUP_MANAGER', 'EDITOR', 'VIEWER']),
    })
  ),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const targetUserId = c.req.param('userId');
    const { groupRole } = c.req.valid('json');

    db.update(groupMembers)
      .set({ groupRole })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)))
      .run();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'UPDATE_MEMBER_ROLE',
      entityType: 'MEMBER',
      entityId: targetUserId,
      newValues: { groupRole },
    });

    return c.json({ success: true, message: 'Peran anggota berhasil diperbarui' });
  }
);

// DELETE /api/groups/:groupId/members/:userId - Remove member (GROUP_MANAGER)
groupsRouter.delete('/:groupId/members/:userId', requireGroupAccess('GROUP_MANAGER'), async (c) => {
  const actor = c.get('user');
  const groupId = c.req.param('groupId');
  const targetUserId = c.req.param('userId');

  db.delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)))
    .run();

  recordAuditLog({
    groupId,
    actorId: actor.id,
    action: 'REMOVE_MEMBER',
    entityType: 'MEMBER',
    entityId: targetUserId,
  });

  return c.json({ success: true, message: 'Anggota berhasil dikeluarkan dari grup' });
});

// GET /api/groups/:groupId/categories
groupsRouter.get('/:groupId/categories', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');
  const categories = db.select().from(groupCategories).where(eq(groupCategories.groupId, groupId)).all();
  return c.json({ success: true, categories });
});

// POST /api/groups/:groupId/categories - Create category (GROUP_MANAGER)
groupsRouter.post(
  '/:groupId/categories',
  requireGroupAccess('GROUP_MANAGER'),
  zValidator(
    'json',
    z.object({
      name: z.string().trim().min(1).transform(stripHtml),
      type: z.enum(['EXPENSE', 'INCOME']).default('EXPENSE'),
      budgetAllocation: z.number().int().min(0).default(0),
    })
  ),
  async (c) => {
    const actor = c.get('user');
    const groupId = c.req.param('groupId');
    const { name, type, budgetAllocation } = c.req.valid('json');

    const existing = db
      .select()
      .from(groupCategories)
      .where(and(eq(groupCategories.groupId, groupId), eq(groupCategories.name, name)))
      .get();

    if (existing) {
      return c.json({ success: false, error: 'Kategori dengan nama ini sudah ada di grup' }, 400);
    }

    const id = uuidv4();
    db.insert(groupCategories)
      .values({
        id,
        groupId,
        name,
        type,
        budgetAllocation,
      })
      .run();

    recordAuditLog({
      groupId,
      actorId: actor.id,
      action: 'CREATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: id,
      newValues: { name, type, budgetAllocation },
    });

    return c.json({ success: true, categoryId: id });
  }
);

// GET /api/groups/:groupId/units
groupsRouter.get('/:groupId/units', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');
  const units = db.select().from(groupUnits).where(eq(groupUnits.groupId, groupId)).all();
  return c.json({ success: true, units: units.map((u) => u.name) });
});

// POST /api/groups/:groupId/units - Add custom unit (GROUP_MANAGER)
groupsRouter.post(
  '/:groupId/units',
  requireGroupAccess('GROUP_MANAGER'),
  zValidator(
    'json',
    z.object({
      name: z.string().trim().min(1).transform(stripHtml),
    })
  ),
  async (c) => {
    const groupId = c.req.param('groupId');
    const { name } = c.req.valid('json');

    const existing = db
      .select()
      .from(groupUnits)
      .where(and(eq(groupUnits.groupId, groupId), eq(groupUnits.name, name)))
      .get();

    if (!existing) {
      db.insert(groupUnits)
        .values({
          id: uuidv4(),
          groupId,
          name,
        })
        .run();
    }

    return c.json({ success: true, name });
  }
);
