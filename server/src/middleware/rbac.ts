import type { MiddlewareHandler } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { groupMembers, financialGroups, type User } from '../db/schema.js';
import type { AppEnv, GroupRole } from '../types/env.js';

export { type GroupRole } from '../types/env.js';

const ROLE_HIERARCHY: Record<GroupRole, number> = {
  GROUP_MANAGER: 3,
  EDITOR: 2,
  VIEWER: 1,
};

/**
 * Require system role: SUPER_ADMIN
 */
export const requireSuperAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user') as User | undefined;
  if (!user || user.systemRole !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Akses ditolak: Membutuhkan hak akses Super Admin' }, 403);
  }
  await next();
};

/**
 * Require access to specific group with minimum role (IDOR/BOLA Protection)
 */
export function requireGroupAccess(minRole: GroupRole = 'VIEWER'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user') as User | undefined;
    if (!user) {
      return c.json({ success: false, error: 'Akses ditolak: Tidak terautentikasi' }, 401);
    }

    const groupId = c.req.param('groupId');
    if (!groupId) {
      return c.json({ success: false, error: 'Parameter groupId tidak ditemukan' }, 400);
    }

    // Verify group exists
    const group = db.select().from(financialGroups).where(eq(financialGroups.id, groupId)).get();
    if (!group) {
      return c.json({ success: false, error: 'Grup keuangan tidak ditemukan' }, 404);
    }

    // SUPER_ADMIN has full manager rights across all groups
    if (user.systemRole === 'SUPER_ADMIN') {
      c.set('groupId', groupId);
      c.set('groupRole', 'GROUP_MANAGER');
      c.set('group', group);
      return await next();
    }

    // Standard user: must be explicit member of this group
    const membership = db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .get();

    if (!membership) {
      return c.json({ success: false, error: 'Akses ditolak: Anda bukan anggota grup keuangan ini' }, 403);
    }

    const userRole = membership.groupRole as GroupRole;
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      return c.json(
        {
          success: false,
          error: `Akses ditolak: Tindakan ini membutuhkan peran minimal ${minRole}`,
        },
        403
      );
    }

    c.set('groupId', groupId);
    c.set('groupRole', userRole);
    c.set('group', group);

    await next();
  };
}
