import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  financialGroups,
  groupCategories,
  transactions,
  type FinancialGroup,
} from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireGroupAccess } from '../middleware/rbac.js';
import type { AppEnv } from '../types/env.js';

export const analyticsRouter = new Hono<AppEnv>();

analyticsRouter.use('*', authMiddleware);

// GET /api/groups/:groupId/analytics
analyticsRouter.get('/:groupId/analytics', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');
  const group = c.get('group') as FinancialGroup;

  // 1. Fetch all transactions for this group
  const txList = db
    .select({
      id: transactions.id,
      txDate: transactions.txDate,
      type: transactions.type,
      description: transactions.description,
      categoryId: transactions.categoryId,
      quantity: transactions.quantity,
      unitPrice: transactions.unitPrice,
      totalPrice: transactions.totalPrice,
      dataStatus: transactions.dataStatus,
    })
    .from(transactions)
    .where(eq(transactions.groupId, groupId))
    .all();

  // 2. Fetch categories
  const categories = db
    .select({
      id: groupCategories.id,
      name: groupCategories.name,
      type: groupCategories.type,
      budgetAllocation: groupCategories.budgetAllocation,
    })
    .from(groupCategories)
    .where(eq(groupCategories.groupId, groupId))
    .all();

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // 3. Compute KPI metrics
  let totalExpense = 0;
  let totalIncome = 0;
  let totalTransactions = txList.length;
  let needsReviewCount = 0;

  for (const t of txList) {
    if (t.type === 'INCOME') {
      totalIncome += t.totalPrice;
    } else {
      totalExpense += t.totalPrice;
    }

    if (t.dataStatus === 'POTENTIAL_DUPLICATE' || t.dataStatus === 'INCOMPLETE') {
      needsReviewCount += 1;
    }
  }

  // If group has a budget limit defined, use it or fallback to totalIncome
  const budgetEffective = group.budgetLimit > 0 ? group.budgetLimit : totalIncome;
  const remainingBalance = budgetEffective - totalExpense;
  const remainingPercentage =
    budgetEffective > 0 ? Math.max(0, Math.round((remainingBalance / budgetEffective) * 100)) : 0;

  // 4. Category Breakdown Table with automatic "Belum dikategorikan"
  const catStats = new Map<
    string,
    { id: string | null; name: string; count: number; total: number; allocation: number }
  >();

  for (const cat of categories) {
    catStats.set(cat.id, {
      id: cat.id,
      name: cat.name,
      count: 0,
      total: 0,
      allocation: cat.budgetAllocation,
    });
  }

  // Uncategorized bucket
  const uncategorizedKey = 'uncategorized';
  catStats.set(uncategorizedKey, {
    id: null,
    name: 'Belum dikategorikan',
    count: 0,
    total: 0,
    allocation: 0,
  });

  for (const t of txList) {
    if (t.type === 'EXPENSE') {
      const key = t.categoryId && catStats.has(t.categoryId) ? t.categoryId : uncategorizedKey;
      const stat = catStats.get(key)!;
      stat.count += 1;
      stat.total += t.totalPrice;
    }
  }

  const categoryBreakdown = Array.from(catStats.values()).map((c) => ({
    ...c,
    percentage: totalExpense > 0 ? Number(((c.total / totalExpense) * 100).toFixed(1)) : 0,
  }));

  // 5. Reconciliation Check:
  // Sum of all individual expense ledger rows vs sum of category breakdown table
  const sumFromLedger = txList
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.totalPrice, 0);

  const sumFromCategoryBreakdown = categoryBreakdown.reduce((sum, c) => sum + c.total, 0);

  const reconciliationStatus =
    sumFromLedger === sumFromCategoryBreakdown && sumFromLedger === totalExpense
      ? 'OK - Sama'
      : 'Selisih';

  // 6. Trend Timeline (Grouped by Date)
  const dateMap = new Map<string, { date: string; expense: number; income: number }>();
  for (const t of txList) {
    if (!dateMap.has(t.txDate)) {
      dateMap.set(t.txDate, { date: t.txDate, expense: 0, income: 0 });
    }
    const d = dateMap.get(t.txDate)!;
    if (t.type === 'EXPENSE') {
      d.expense += t.totalPrice;
    } else {
      d.income += t.totalPrice;
    }
  }

  const timeline = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 7. Top Expense Items
  const topExpenses = txList
    .filter((t) => t.type === 'EXPENSE')
    .sort((a, b) => b.totalPrice - a.totalPrice)
    .slice(0, 7)
    .map((t) => ({
      id: t.id,
      txDate: t.txDate,
      description: t.description,
      categoryName: t.categoryId ? categoryMap.get(t.categoryId) || 'Lainnya' : 'Belum dikategorikan',
      totalPrice: t.totalPrice,
      dataStatus: t.dataStatus,
    }));

  return c.json({
    success: true,
    kpis: {
      totalExpense,
      totalIncome,
      budgetEffective,
      remainingBalance,
      remainingPercentage,
      totalTransactions,
      needsReviewCount,
      reconciliationStatus,
      sumFromLedger,
      sumFromCategoryBreakdown,
    },
    categoryBreakdown,
    timeline,
    topExpenses,
  });
});
