/**
 * app/api/transactions/route.ts
 *
 * GET /api/transactions
 *
 * Supports filters:
 * - search: string (matches cleanDescription + merchantName)
 * - categoryId: string
 * - direction: DEBIT | CREDIT
 * - dateFrom: YYYY-MM-DD
 * - dateTo: YYYY-MM-DD
 * - accountId: string
 * - page: number
 * - limit: number (max 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId");
  const direction = searchParams.get("direction") as "DEBIT" | "CREDIT" | null;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const accountId = searchParams.get("accountId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const skip = (page - 1) * limit;

  // Build Prisma where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: SYSTEM_USER_ID };
  if (search) {
    where.OR = [
      { cleanDescription: { contains: search } },
      { merchantName: { contains: search } },
      { rawDescription: { contains: search } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (direction) where.direction = direction;
  if (accountId) where.accountId = accountId;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo + "T23:59:59Z");
  }

  const [transactions, total] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: limit,
      include: {
        category: { select: { id: true, name: true, color: true } },
        account: { select: { id: true, name: true, institution: true } },
      },
    }),
    db.transaction.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: { transactions, total, page, limit } });
}
