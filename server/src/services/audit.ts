import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

export function recordAuditLog(params: {
  groupId?: string | null;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
}) {
  try {
    db.insert(auditLogs)
      .values({
        id: uuidv4(),
        groupId: params.groupId || null,
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
        newValues: params.newValues ? JSON.stringify(params.newValues) : null,
        ipAddress: params.ipAddress || null,
      })
      .run();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
