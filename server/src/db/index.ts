import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema.js';

const DB_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(DB_DIR, 'nextcash.sqlite');

export const sqlite = new Database(DB_PATH);

// Enable WAL mode, foreign keys, and high-performance PRAGMAs
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = -64000');
sqlite.pragma('temp_store = MEMORY');
sqlite.pragma('mmap_size = 268435456');

// Initialize database schema tables directly
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      system_role TEXT NOT NULL DEFAULT 'USER' CHECK(system_role IN ('SUPER_ADMIN', 'USER')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS financial_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      budget_limit INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES financial_groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_role TEXT NOT NULL CHECK(group_role IN ('GROUP_MANAGER', 'EDITOR', 'VIEWER')),
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_categories (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES financial_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK(type IN ('EXPENSE', 'INCOME')),
      budget_allocation INTEGER NOT NULL DEFAULT 0,
      UNIQUE(group_id, name)
    );

    CREATE TABLE IF NOT EXISTS group_units (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES financial_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, name)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES financial_groups(id) ON DELETE CASCADE,
      tx_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK(type IN ('EXPENSE', 'INCOME')),
      description TEXT NOT NULL,
      category_id TEXT REFERENCES group_categories(id) ON DELETE SET NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      total_price INTEGER NOT NULL,
      data_status TEXT NOT NULL DEFAULT 'OK' CHECK(data_status IN ('OK', 'INCOMPLETE', 'POTENTIAL_DUPLICATE', 'VERIFIED_DUPLICATE_OK')),
      verification_note TEXT,
      verified_by TEXT REFERENCES users(id),
      receipt_path TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS transactions_group_date_idx ON transactions(group_id, tx_date);
    CREATE INDEX IF NOT EXISTS transactions_group_idx ON transactions(group_id);
    CREATE INDEX IF NOT EXISTS transactions_group_status_idx ON transactions(group_id, data_status);
    CREATE INDEX IF NOT EXISTS transactions_group_cat_idx ON transactions(group_id, category_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      group_id TEXT REFERENCES financial_groups(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS audit_logs_group_created_idx ON audit_logs(group_id, created_at);
    CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id);
  `);
}

// Auto initialize on load
initDb();

export const db = drizzle(sqlite, { schema });
