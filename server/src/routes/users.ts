import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users, groupMembers, financialGroups } from '../db/schema.js';
import { hashPassword, stripHtml } from '../utils/security.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/rbac.js';
import { recordAuditLog } from '../services/audit.js';
import type { AppEnv } from '../types/env.js';

export const usersRouter = new Hono<AppEnv>();

usersRouter.use('*', authMiddleware, requireSuperAdmin);

// Schema for user creation
const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').transform(stripHtml),
  email: z.string().trim().email('Format email tidak valid').transform((val) => stripHtml(val).toLowerCase()),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
  systemRole: z.enum(['SUPER_ADMIN', 'USER']).default('USER'),
});

// Schema for user update
const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').transform(stripHtml).optional(),
  email: z.string().trim().email('Format email tidak valid').transform((val) => stripHtml(val).toLowerCase()).optional(),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter').optional(),
  systemRole: z.enum(['SUPER_ADMIN', 'USER']).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
});

// GET /api/users - List all users
usersRouter.get('/', async (c) => {
  const allUsers = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      systemRole: users.systemRole,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();

  // Fetch memberships for each user
  const allMemberships = db
    .select({
      userId: groupMembers.userId,
      groupId: groupMembers.groupId,
      groupRole: groupMembers.groupRole,
      groupName: financialGroups.name,
    })
    .from(groupMembers)
    .innerJoin(financialGroups, eq(groupMembers.groupId, financialGroups.id))
    .all();

  const userGroupMap = new Map<string, Array<{ groupId: string; groupName: string; groupRole: string }>>();
  for (const m of allMemberships) {
    if (!userGroupMap.has(m.userId)) {
      userGroupMap.set(m.userId, []);
    }
    userGroupMap.get(m.userId)!.push({
      groupId: m.groupId,
      groupName: m.groupName,
      groupRole: m.groupRole,
    });
  }

  const enrichedUsers = allUsers.map((u) => ({
    ...u,
    groups: userGroupMap.get(u.id) || [],
  }));

  return c.json({ success: true, users: enrichedUsers });
});

// POST /api/users - Create user
usersRouter.post('/', zValidator('json', createUserSchema), async (c) => {
  const actor = c.get('user');
  const { name, email, password, systemRole } = c.req.valid('json');

  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return c.json({ success: false, error: 'Email sudah digunakan' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const id = uuidv4();

  db.insert(users)
    .values({
      id,
      name,
      email,
      passwordHash,
      systemRole,
      isActive: 1,
    })
    .run();

  recordAuditLog({
    actorId: actor.id,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: id,
    newValues: { name, email, systemRole },
  });

  return c.json({
    success: true,
    user: { id, name, email, systemRole, isActive: 1 },
  });
});

// PATCH /api/users/:userId - Update user
usersRouter.patch('/:userId', zValidator('json', updateUserSchema), async (c) => {
  const actor = c.get('user');
  const userId = c.req.param('userId');
  const updates = c.req.valid('json');

  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) {
    return c.json({ success: false, error: 'Pengguna tidak ditemukan' }, 404);
  }

  const setValues: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.name) setValues.name = updates.name;
  if (updates.email) {
    const existingWithEmail = db.select().from(users).where(eq(users.email, updates.email)).get();
    if (existingWithEmail && existingWithEmail.id !== userId) {
      return c.json({ success: false, error: 'Email sudah digunakan oleh akun lain' }, 400);
    }
    setValues.email = updates.email;
  }
  if (updates.password) {
    setValues.passwordHash = await hashPassword(updates.password);
  }
  if (updates.systemRole) setValues.systemRole = updates.systemRole;
  if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

  db.update(users).set(setValues).where(eq(users.id, userId)).run();

  recordAuditLog({
    actorId: actor.id,
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: userId,
    oldValues: { name: targetUser.name, email: targetUser.email, systemRole: targetUser.systemRole, isActive: targetUser.isActive },
    newValues: setValues,
  });

  return c.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
});

// DELETE /api/users/:userId - Delete user
usersRouter.delete('/:userId', async (c) => {
  const actor = c.get('user');
  const userId = c.req.param('userId');

  if (actor.id === userId) {
    return c.json({ success: false, error: 'Tidak dapat menghapus akun Anda sendiri' }, 400);
  }

  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) {
    return c.json({ success: false, error: 'Pengguna tidak ditemukan' }, 404);
  }

  db.delete(users).where(eq(users.id, userId)).run();

  recordAuditLog({
    actorId: actor.id,
    action: 'DELETE_USER',
    entityType: 'USER',
    entityId: userId,
    oldValues: { email: targetUser.email, name: targetUser.name },
  });

  return c.json({ success: true, message: 'Pengguna berhasil dihapus' });
});
