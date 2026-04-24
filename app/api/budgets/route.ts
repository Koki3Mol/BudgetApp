/**
 * app/api/budgets/route.ts
 *
 * GET /api/budgets?year=2024&month=3   — list budgets
 * POST /api/budgets                     — create budget
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

const CreateBudgetSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  currency: z.string().default("ZAR"),
  items: z.array(z.object({
    categoryId: z.string(),
    amount: z.number().positive(),
    notes: z.string().optional(),
  })).default([]),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;

  const budgets = await db.budget.findMany({
    where: { userId: SYSTEM_USER_ID, ...(year ? { year } : {}), ...(month ? { month } : {}) },
    include: { items: { include: { category: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json({ success: true, data: budgets });
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateBudgetSchema>;
  try {
    body = CreateBudgetSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }

  const budget = await db.budget.create({
    data: {
      userId: SYSTEM_USER_ID,
      name: body.name,
      year: body.year,
      month: body.month,
      currency: body.currency,
      items: {
        create: body.items.map((i) => ({
          categoryId: i.categoryId,
          amount: i.amount,
          notes: i.notes,
        })),
      },
    },
    include: { items: { include: { category: true } } },
  });

  return NextResponse.json({ success: true, data: budget }, { status: 201 });
}
