/**
 * app/api/budgets/monthly/actuals/route.ts
 *
 * GET /api/budgets/monthly/actuals?year=2026&month=4
 *
 * Returns actual transaction totals for each category in the given month,
 * split by direction (DEBIT / CREDIT) so the budget page can show
 * Money In vs Money Out.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";

const SYSTEM_USER_ID = "default";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(from);

  // Aggregate by categoryId + direction
  const grouped = await db.transaction.groupBy({
    by: ["categoryId", "direction"],
    where: {
      userId: SYSTEM_USER_ID,
      date: { gte: from, lte: to },
      isDuplicate: false,
    },
    _sum: { amount: true },
  });

  // Fetch category names
  const catIds = [...new Set(grouped.map((g) => g.categoryId).filter(Boolean))] as string[];
  const categories = await db.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true, color: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Build a flat map: categoryId -> { debit, credit }
  const actuals = new Map<string, { categoryId: string; categoryName: string; categoryColor: string; debit: number; credit: number }>();

  for (const row of grouped) {
    if (!row.categoryId) continue;
    const cat = catMap.get(row.categoryId);
    if (!cat) continue;
    if (!actuals.has(row.categoryId)) {
      actuals.set(row.categoryId, { categoryId: row.categoryId, categoryName: cat.name, categoryColor: cat.color, debit: 0, credit: 0 });
    }
    const entry = actuals.get(row.categoryId)!;
    if (row.direction === "DEBIT") entry.debit += row._sum.amount ?? 0;
    else entry.credit += row._sum.amount ?? 0;
  }

  // Also include uncategorized totals
  const uncategorized = await db.transaction.aggregate({
    where: {
      userId: SYSTEM_USER_ID,
      date: { gte: from, lte: to },
      isDuplicate: false,
      categoryId: null,
    },
    _sum: { amount: true },
    // We can't group by direction here without groupBy, so do two queries
  });

  const uncatDebit = await db.transaction.aggregate({
    where: { userId: SYSTEM_USER_ID, date: { gte: from, lte: to }, isDuplicate: false, categoryId: null, direction: "DEBIT" },
    _sum: { amount: true },
  });
  const uncatCredit = await db.transaction.aggregate({
    where: { userId: SYSTEM_USER_ID, date: { gte: from, lte: to }, isDuplicate: false, categoryId: null, direction: "CREDIT" },
    _sum: { amount: true },
  });

  const results = Array.from(actuals.values());

  // Summary totals
  const totalIn = results.reduce((s, r) => s + r.credit, 0) + (uncatCredit._sum.amount ?? 0);
  const totalOut = results.reduce((s, r) => s + r.debit, 0) + (uncatDebit._sum.amount ?? 0);

  return NextResponse.json({
    success: true,
    data: {
      year,
      month,
      totalIn,
      totalOut,
      remaining: totalIn - totalOut,
      actuals: results,
    },
  });
}
