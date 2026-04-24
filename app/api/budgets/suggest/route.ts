/**
 * app/api/budgets/suggest/route.ts
 *
 * GET /api/budgets/suggest?months=6
 *
 * Derives budget suggestions from the last N months of transactions.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestBudgets } from "@/lib/finance/budget";
import { format, startOfMonth, subMonths } from "date-fns";

const SYSTEM_USER_ID = "default";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const months = Math.min(24, Math.max(2, parseInt(searchParams.get("months") ?? "6")));

  const from = startOfMonth(subMonths(new Date(), months));

  const spending = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId: SYSTEM_USER_ID,
      direction: "DEBIT",
      date: { gte: from },
      isDuplicate: false,
      categoryId: { not: null },
    },
    _sum: { amount: true },
  });

  // We need per-month per-category data for the trimmed mean
  const raw = await db.transaction.findMany({
    where: {
      userId: SYSTEM_USER_ID,
      direction: "DEBIT",
      date: { gte: from },
      isDuplicate: false,
      categoryId: { not: null },
    },
    select: { categoryId: true, amount: true, date: true },
  });

  // Aggregate to month+category
  const monthCatMap = new Map<string, { categoryId: string; categoryName: string; month: string; totalAmount: number }>();
  const catIds = [...new Set(raw.map((r) => r.categoryId).filter(Boolean))] as string[];
  const cats = await db.category.findMany({ where: { id: { in: catIds } } });
  const catNameMap = new Map(cats.map((c) => [c.id, c.name]));

  for (const tx of raw) {
    if (!tx.categoryId) continue;
    const month = format(tx.date, "yyyy-MM");
    const key = `${tx.categoryId}::${month}`;
    const existing = monthCatMap.get(key);
    if (existing) {
      existing.totalAmount += tx.amount;
    } else {
      monthCatMap.set(key, {
        categoryId: tx.categoryId,
        categoryName: catNameMap.get(tx.categoryId) ?? "Unknown",
        month,
        totalAmount: tx.amount,
      });
    }
  }

  const records = Array.from(monthCatMap.values());
  const suggestions = suggestBudgets(records);

  return NextResponse.json({ success: true, data: suggestions });
}
