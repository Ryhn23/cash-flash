import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireGroupAccess, requireSuperAdmin } from '../middleware/rbac.js';
import type { AppEnv } from '../types/env.js';

export const auditRouter = new Hono<AppEnv>();

auditRouter.use('*', authMiddleware);

// GET /api/groups/:groupId/audit - Group activity feed & history
auditRouter.get('/:groupId/audit', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');

  const logs = db
    .select({
      id: auditLogs.id,
      groupId: auditLogs.groupId,
      actorId: auditLogs.actorId,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(eq(auditLogs.groupId, groupId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50)
    .all();

  return c.json({ success: true, logs });
});

// GET /api/audit - Global system audit logs (SUPER_ADMIN only)
auditRouter.get('/', requireSuperAdmin, async (c) => {
  const logs = db
    .select({
      id: auditLogs.id,
      groupId: auditLogs.groupId,
      actorId: auditLogs.actorId,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100)
    .all();

  return c.json({ success: true, logs });
});
