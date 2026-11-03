import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
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

// GET /api/groups/:groupId/analytics - Fast SQL-aggregated telemetry
analyticsRouter.get('/:groupId/analytics', requireGroupAccess('VIEWER'), async (c) => {
  const groupId = c.req.param('groupId');
  const group = c.get('group') as FinancialGroup;

  // 1. Compute KPI metrics using native SQLite aggregations
  const [kpiRow] = db
    .select({
      totalExpense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'EXPENSE' THEN ${transactions.totalPrice} ELSE 0 END), 0)`,
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'INCOME' THEN ${transactions.totalPrice} ELSE 0 END), 0)`,
      totalTransactions: sql<number>`COUNT(*)`,
      needsReviewCount: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.dataStatus} IN ('POTENTIAL_DUPLICATE', 'INCOMPLETE') THEN 1 ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.groupId, groupId))
    .all();

  const totalExpense = Number(kpiRow?.totalExpense || 0);
  const totalIncome = Number(kpiRow?.totalIncome || 0);
  const totalTransactions = Number(kpiRow?.totalTransactions || 0);
  const needsReviewCount = Number(kpiRow?.needsReviewCount || 0);

  // 2. Fetch group categories
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

  // If group has a budget limit defined, use it or fallback to totalIncome
  const budgetEffective = group.budgetLimit > 0 ? group.budgetLimit : totalIncome;
  const remainingBalance = budgetEffective - totalExpense;
  const remainingPercentage =
    budgetEffective > 0 ? Math.max(0, Math.round((remainingBalance / budgetEffective) * 100)) : 0;

  // 3. Category Breakdown aggregated directly via SQL GROUP BY
  const catAggRows = db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(${transactions.totalPrice}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.groupId, groupId), eq(transactions.type, 'EXPENSE')))
    .groupBy(transactions.categoryId)
    .all();

  const catAggMap = new Map<string | null, { count: number; total: number }>();
  for (const row of catAggRows) {
    catAggMap.set(row.categoryId, {
      count: Number(row.count),
      total: Number(row.total),
    });
  }

  const categoryBreakdown: Array<{
    id: string | null;
    name: string;
    count: number;
    total: number;
    allocation: number;
    percentage: number;
  }> = categories.map((cat) => {
    const agg = catAggMap.get(cat.id) || { count: 0, total: 0 };
    return {
      id: cat.id,
      name: cat.name,
      count: agg.count,
      total: agg.total,
      allocation: cat.budgetAllocation,
      percentage: totalExpense > 0 ? Number(((agg.total / totalExpense) * 100).toFixed(1)) : 0,
    };
  });

  // Check for uncategorized expenses
  const uncategorizedAgg = catAggMap.get(null);
  if (uncategorizedAgg && uncategorizedAgg.count > 0) {
    categoryBreakdown.push({
      id: null,
      name: 'Belum dikategorikan',
      count: uncategorizedAgg.count,
      total: uncategorizedAgg.total,
      allocation: 0,
      percentage: totalExpense > 0 ? Number(((uncategorizedAgg.total / totalExpense) * 100).toFixed(1)) : 0,
    });
  } else {
    categoryBreakdown.push({
      id: null,
      name: 'Belum dikategorikan',
      count: 0,
      total: 0,
      allocation: 0,
      percentage: 0,
    });
  }

  // 4. Reconciliation Check
  const sumFromLedger = totalExpense;
  const sumFromCategoryBreakdown = categoryBreakdown.reduce((sum, c) => sum + c.total, 0);
  const reconciliationStatus =
    sumFromLedger === sumFromCategoryBreakdown && sumFromLedger === totalExpense
      ? 'OK - Sama'
      : 'Selisih';

  // 5. Trend Timeline aggregated via SQL GROUP BY tx_date
  const timelineRows = db
    .select({
      date: transactions.txDate,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'EXPENSE' THEN ${transactions.totalPrice} ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'INCOME' THEN ${transactions.totalPrice} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.groupId, groupId))
    .groupBy(transactions.txDate)
    .orderBy(transactions.txDate)
    .all();

  const timeline = timelineRows.map((r) => ({
    date: r.date,
    expense: Number(r.expense),
    income: Number(r.income),
  }));

  // 6. Top 7 Expense Items via SQL ORDER BY total_price DESC LIMIT 7
  const topExpensesRows = db
    .select({
      id: transactions.id,
      txDate: transactions.txDate,
      description: transactions.description,
      categoryId: transactions.categoryId,
      totalPrice: transactions.totalPrice,
      dataStatus: transactions.dataStatus,
    })
    .from(transactions)
    .where(and(eq(transactions.groupId, groupId), eq(transactions.type, 'EXPENSE')))
    .orderBy(desc(transactions.totalPrice))
    .limit(7)
    .all();

  const topExpenses = topExpensesRows.map((t) => ({
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
