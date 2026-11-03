export type SystemRole = 'SUPER_ADMIN' | 'USER';
export type GroupRole = 'GROUP_MANAGER' | 'EDITOR' | 'VIEWER';
export type TransactionType = 'EXPENSE' | 'INCOME';
export type DataStatus = 'OK' | 'INCOMPLETE' | 'POTENTIAL_DUPLICATE' | 'VERIFIED_DUPLICATE_OK';

export interface User {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
  isActive?: number;
  createdAt?: string;
  updatedAt?: string;
  groups?: Array<{
    groupId: string;
    groupName: string;
    groupRole: GroupRole;
  }>;
}

export interface FinancialGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  budgetLimit: number;
  isArchived: number;
  userRole?: GroupRole;
  memberCount?: number;
  transactionCount?: number;
  createdAt?: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupRole: GroupRole;
  joinedAt: string;
  name: string;
  email: string;
}

export interface GroupCategory {
  id: string;
  groupId: string;
  name: string;
  type: TransactionType;
  budgetAllocation: number;
}

export interface Transaction {
  id: string;
  groupId: string;
  txDate: string;
  type: TransactionType;
  description: string;
  categoryId: string | null;
  categoryName?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  dataStatus: DataStatus;
  verificationNote: string | null;
  verifiedBy: string | null;
  receiptPath: string | null;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsKpis {
  totalExpense: number;
  totalIncome: number;
  budgetEffective: number;
  remainingBalance: number;
  remainingPercentage: number;
  totalTransactions: number;
  needsReviewCount: number;
  reconciliationStatus: 'OK - Sama' | 'Selisih';
  sumFromLedger: number;
  sumFromCategoryBreakdown: number;
}

export interface CategoryBreakdownItem {
  id: string | null;
  name: string;
  count: number;
  total: number;
  allocation: number;
  percentage: number;
}

export interface TimelineItem {
  date: string;
  expense: number;
  income: number;
}

export interface TopExpenseItem {
  id: string;
  txDate: string;
  description: string;
  categoryName: string;
  totalPrice: number;
  dataStatus: DataStatus;
}

export interface AnalyticsReport {
  kpis: AnalyticsKpis;
  categoryBreakdown: CategoryBreakdownItem[];
  timeline: TimelineItem[];
  topExpenses: TopExpenseItem[];
}

export interface AuditLogItem {
  id: string;
  groupId: string | null;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  createdAt: string;
}
