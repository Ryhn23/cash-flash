import { v4 as uuidv4 } from 'uuid';
import { db, initDb } from './index.js';
import { users } from './schema.js';
import { hashPassword } from '../utils/security.js';

/**
 * Production Fresh Start:
 * Initializes only the primary SUPER_ADMIN account when the database has zero users.
 * Does NOT generate any dummy transactions, mock groups, or sample users.
 */
export async function initProductionAdmin(): Promise<void> {
  initDb();

  const existingUsers = db.select().from(users).all();
  if (existingUsers.length > 0) {
    return;
  }

  const adminName = process.env.ADMIN_NAME || 'Administrator Utama';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@nextcash.io').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

  const adminId = uuidv4();
  const passwordHash = await hashPassword(adminPassword);

  db.insert(users)
    .values({
      id: adminId,
      name: adminName,
      email: adminEmail,
      passwordHash,
      systemRole: 'SUPER_ADMIN',
      isActive: 1,
    })
    .run();

  console.log(`[Next-Cash] Inisialisasi awal (Production Fresh Start): SUPER_ADMIN dibuat -> ${adminEmail}`);
}

