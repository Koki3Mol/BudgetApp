/**
 * app/api/budgets/monthly/route.ts
 *
 * GET  /api/budgets/monthly?year=2026&month=4
 *   Returns the budget plan for the given month (or empty if none created yet).
 *
 * PUT  /api/budgets/monthly
 *   Upserts the entire monthly budget.
 *   Body: { year, month, groups: [{ name, items: [{ label, categoryId?, budgetAmount }] }] }
 *
 * The "groups" concept maps to the sections in the UI (Income, Expenses, Debt, etc).
 * We store each group item as a BudgetItem on a single Budget record for that month.
 * The item label is stored in the `notes` field since Prisma schema already has it.
 * We use a special categoryId convention: if no real category, we store a virtual
 * category named after the label under a "budget_group:GroupName" prefix so items
 * stay identifiable without requiring extra schema changes.
 *
 * For simplicity we encode the group structure in the Budget.name field as JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

export interface BudgetLineItem {
  id?: string;           // client-side temp id or existing BudgetItem id
  label: string;
  categoryId?: string | null;
  budgetAmount: number;
}

export interface BudgetGroup {
  name: string;          // "Income" | "Expenses" | "Debt" | etc.
  items: BudgetLineItem[];
}

export interface MonthlyBudgetPayload {
  year: number;
  month: number;         // 1-12
  groups: BudgetGroup[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const budget = await db.budget.findFirst({
    where: { userId: SYSTEM_USER_ID, year, month },
    include: { items: { include: { category: true } } },
  });

  if (!budget) {
    return NextResponse.json({ success: true, data: null });
  }

  // Parse groups from name field
  let groups: BudgetGroup[] = [];
  try { groups = JSON.parse(budget.name); } catch { groups = []; }

  // Re-attach actual amounts from items (lookup by notes = label within group)
  const itemMap = new Map(budget.items.map((i) => [`${i.notes}`, i]));
  const hydratedGroups = groups.map((g) => ({
    ...g,
    items: g.items.map((item) => {
      const key = `${g.name}::${item.label}`;
      const dbItem = itemMap.get(key);
      return {
        ...item,
        id: dbItem?.id,
        budgetAmount: dbItem?.amount ?? item.budgetAmount,
        categoryId: dbItem?.categoryId ?? item.categoryId,
      };
    }),
  }));

  return NextResponse.json({ success: true, data: { year, month, groups: hydratedGroups } });
}

export async function PUT(req: NextRequest) {
  const body: MonthlyBudgetPayload = await req.json();
  const { year, month, groups } = body;

  if (!year || !month || !groups) {
    return NextResponse.json({ success: false, error: "year, month, groups required" }, { status: 400 });
  }

  // Upsert budget record
  const existing = await db.budget.findFirst({
    where: { userId: SYSTEM_USER_ID, year, month },
  });

  // Store group structure as JSON in name field
  // We strip amounts from the name JSON (just labels + categoryId) since amounts go in items
  const groupStructure = groups.map((g) => ({
    name: g.name,
    items: g.items.map((i) => ({ label: i.label, categoryId: i.categoryId ?? null })),
  }));

  let budgetId: string;
  if (existing) {
    budgetId = existing.id;
    await db.budget.update({
      where: { id: existing.id },
      data: { name: JSON.stringify(groupStructure), updatedAt: new Date() },
    });
    // Delete old items and recreate
    await db.budgetItem.deleteMany({ where: { budgetId: existing.id } });
  } else {
    const created = await db.budget.create({
      data: {
        userId: SYSTEM_USER_ID,
        year,
        month,
        name: JSON.stringify(groupStructure),
        currency: "ZAR",
      },
    });
    budgetId = created.id;
  }

  // Ensure all referenced categories exist (create virtual ones if needed)
  const allCategories = await db.category.findMany({ where: { userId: SYSTEM_USER_ID } });
  const catByName = new Map(allCategories.map((c) => [c.name, c.id]));

  const itemsToCreate: { budgetId: string; categoryId: string; amount: number; notes: string }[] = [];

  for (const group of groups) {
    for (const item of group.items) {
      let categoryId = item.categoryId ?? null;

      if (!categoryId) {
        // Create or find a virtual category for this line item
        const virtualName = item.label;
        if (catByName.has(virtualName)) {
          categoryId = catByName.get(virtualName)!;
        } else {
          const cat = await db.category.create({
            data: {
              userId: SYSTEM_USER_ID,
              name: virtualName,
              color: "#9ca3af",
              isSystem: false,
            },
          });
          categoryId = cat.id;
          catByName.set(virtualName, categoryId);
        }
      }

      itemsToCreate.push({
        budgetId,
        categoryId,
        amount: item.budgetAmount,
        notes: `${group.name}::${item.label}`,
      });
    }
  }

  await db.budgetItem.createMany({ data: itemsToCreate });

  return NextResponse.json({ success: true, data: { budgetId, year, month } });
}
