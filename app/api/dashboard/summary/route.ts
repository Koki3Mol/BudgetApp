/**
 * app/api/dashboard/summary/route.ts
 *
 * GET /api/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns all data needed to render the dashboard in one call.
 * Queries are parallelized where possible.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { DashboardSummary, MonthlyTrendPoint, CategorySpend, BudgetSnapshot } from "@/lib/types/finance";

const SYSTEM_USER_ID = "default";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Default: current month
  const now = new Date();
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);

  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : defaultFrom;
  const to = searchParams.get("to") ? new Date(searchParams.get("to")! + "T23:59:59Z") : defaultTo;

  const periodWhere = {
    userId: SYSTEM_USER_ID,
    date: { gte: from, lte: to },
    isDuplicate: false,
  };

  // Run all aggregations in parallel
  const [
    incomeAgg,
    expenseAgg,
    categoryAgg,
    recentTxs,
    activeBudget,
    importHealthData,
    portfolioData,
  ] = await Promise.all([
    // Total income
    db.transaction.aggregate({
      where: { ...periodWhere, direction: "CREDIT" },
      _sum: { amount: true },
    }),
    // Total expenses
    db.transaction.aggregate({
      where: { ...periodWhere, direction: "DEBIT" },
      _sum: { amount: true },
    }),
    // Category breakdown
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { ...periodWhere, direction: "DEBIT" },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    }),
    // Recent transactions (last 10)
    db.transaction.findMany({
      where: { userId: SYSTEM_USER_ID, isDuplicate: false },
      orderBy: { date: "desc" },
      take: 10,
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    // Active budget for current month
    db.budget.findFirst({
      where: { userId: SYSTEM_USER_ID, year: now.getFullYear(), month: now.getMonth() + 1, isActive: true },
      include: { items: { include: { category: true } } },
    }),
    // Import health
    db.importBatch.findMany({
      where: { userId: SYSTEM_USER_ID },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true },
    }),
    // Portfolio
    db.holding.findMany({
      include: { asset: true },
    }),
  ]);

  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const netCashFlow = totalIncome - totalExpenses;

  // Resolve category names for category breakdown
  const categoryIds = categoryAgg.map((c) => c.categoryId).filter(Boolean) as string[];
  const categories = categoryIds.length > 0
    ? await db.category.findMany({ where: { id: { in: categoryIds } } })
    : [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const topCategories: CategorySpend[] = categoryAgg
    .slice(0, 8)
    .map((c) => {
      const cat = c.categoryId ? catMap.get(c.categoryId) : undefined;
      const amount = c._sum.amount ?? 0;
      return {
        categoryId: c.categoryId ?? "unknown",
        categoryName: cat?.name ?? "Uncategorized",
        categoryColor: cat?.color ?? "#d1d5db",
        amount,
        pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        transactionCount: c._count,
      };
    });

  // Monthly trend: last 6 months
  const monthlyTrend: MonthlyTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(subMonths(now, i));
    const monthKey = format(monthStart, "yyyy-MM");

    const [inc, exp] = await Promise.all([
      db.transaction.aggregate({
        where: { userId: SYSTEM_USER_ID, direction: "CREDIT", date: { gte: monthStart, lte: monthEnd }, isDuplicate: false },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { userId: SYSTEM_USER_ID, direction: "DEBIT", date: { gte: monthStart, lte: monthEnd }, isDuplicate: false },
        _sum: { amount: true },
      }),
    ]);

    const income = inc._sum.amount ?? 0;
    const expenses = exp._sum.amount ?? 0;
    monthlyTrend.push({ month: monthKey, income, expenses, net: income - expenses });
  }

  // Budget snapshot
  const budgetSnapshot: BudgetSnapshot[] = [];
  if (activeBudget) {
    const budgetedCatIds = activeBudget.items.map((i) => i.categoryId);
    const actualByCategory = await db.transaction.groupBy({
      by: ["categoryId"],
      where: { ...periodWhere, direction: "DEBIT", categoryId: { in: budgetedCatIds } },
      _sum: { amount: true },
    });
    const actualMap = new Map(actualByCategory.map((a) => [a.categoryId, a._sum.amount ?? 0]));

    for (const item of activeBudget.items) {
      const actual = actualMap.get(item.categoryId) ?? 0;
      const pct = item.amount > 0 ? (actual / item.amount) * 100 : 0;
      budgetSnapshot.push({
        categoryId: item.categoryId,
        categoryName: item.category.name,
        categoryColor: item.category.color,
        budgeted: item.amount,
        actual,
        pct,
        isOverBudget: actual > item.amount,
      });
    }
  }

  // Import health
  const [uncatCount, dupCount, recentErrorCount, totalBatches] = await Promise.all([
    db.transaction.count({ where: { userId: SYSTEM_USER_ID, categoryId: null } }),
    db.transaction.count({ where: { userId: SYSTEM_USER_ID, isDuplicate: true } }),
    db.importError.count({
      where: { batch: { userId: SYSTEM_USER_ID }, severity: "error" },
    }),
    db.importBatch.count({ where: { userId: SYSTEM_USER_ID } }),
  ]);

  // Net worth: portfolio value + (future: bank balances, liabilities)
  const portfolioValue = portfolioData.reduce((s, h) => s + h.totalCost, 0);

  const summary: DashboardSummary = {
    period: { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] },
    currency: "ZAR",
    totalIncome,
    totalExpenses,
    netCashFlow,
    topCategories,
    monthlyTrend,
    recentTransactions: recentTxs as never,
    budgetSnapshot,
    importHealth: {
      totalBatches,
      lastImportDate: importHealthData[0]?.createdAt.toISOString(),
      uncategorizedCount: uncatCount,
      duplicatesDetected: dupCount,
      recentErrors: recentErrorCount,
    },
    netWorthSnapshot: {
      totalAssets: portfolioValue,
      totalLiabilities: 0,
      netWorth: portfolioValue,
      currency: "ZAR",
      portfolioValue,
    },
  };

  return NextResponse.json({ success: true, data: summary });
}
