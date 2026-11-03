import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1. Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  systemRole: text('system_role', { enum: ['SUPER_ADMIN', 'USER'] }).notNull().default('USER'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 2. Sessions table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  csrfToken: text('csrf_token').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  sessionExpiresIdx: index('sessions_expires_at_idx').on(table.expiresAt),
}));

// 3. Financial Groups table
export const financialGroups = sqliteTable('financial_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  budgetLimit: integer('budget_limit').notNull().default(0),
  isArchived: integer('is_archived').notNull().default(0),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 4. Group Members table
export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => financialGroups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupRole: text('group_role', { enum: ['GROUP_MANAGER', 'EDITOR', 'VIEWER'] }).notNull(),
  joinedAt: text('joined_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  groupUserIdx: uniqueIndex('group_members_group_user_idx').on(table.groupId, table.userId),
}));

// 5. Group Categories table
export const groupCategories = sqliteTable('group_categories', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => financialGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['EXPENSE', 'INCOME'] }).notNull().default('EXPENSE'),
  budgetAllocation: integer('budget_allocation').notNull().default(0),
}, (table) => ({
  groupCatNameIdx: uniqueIndex('group_categories_group_name_idx').on(table.groupId, table.name),
}));

// Group Units table (Customizable units per group)
export const groupUnits = sqliteTable('group_units', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => financialGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  groupUnitNameIdx: uniqueIndex('group_units_group_name_idx').on(table.groupId, table.name),
}));

// 6. Transactions table
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => financialGroups.id, { onDelete: 'cascade' }),
  txDate: text('tx_date').notNull(), // ISO YYYY-MM-DD
  type: text('type', { enum: ['EXPENSE', 'INCOME'] }).notNull().default('EXPENSE'),
  description: text('description').notNull(),
  categoryId: text('category_id').references(() => groupCategories.id, { onDelete: 'set null' }),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(), // Exact integer Rupiah
  dataStatus: text('data_status', { 
    enum: ['OK', 'INCOMPLETE', 'POTENTIAL_DUPLICATE', 'VERIFIED_DUPLICATE_OK'] 
  }).notNull().default('OK'),
  verificationNote: text('verification_note'),
  verifiedBy: text('verified_by').references(() => users.id),
  receiptPath: text('receipt_path'),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  groupDateIdx: index('transactions_group_date_idx').on(table.groupId, table.txDate),
  groupIdx: index('transactions_group_idx').on(table.groupId),
  groupStatusIdx: index('transactions_group_status_idx').on(table.groupId, table.dataStatus),
  groupCategoryIdx: index('transactions_group_cat_idx').on(table.groupId, table.categoryId),
}));

// 7. Audit Logs table
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => financialGroups.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  oldValues: text('old_values'), // JSON
  newValues: text('new_values'), // JSON
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  groupCreatedIdx: index('audit_logs_group_created_idx').on(table.groupId, table.createdAt),
  actorIdx: index('audit_logs_actor_idx').on(table.actorId),
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type FinancialGroup = typeof financialGroups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type GroupCategory = typeof groupCategories.$inferSelect;
export type GroupUnit = typeof groupUnits.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
