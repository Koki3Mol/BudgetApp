/**
 * components/dashboard/budget-progress-snapshot.tsx
 */

"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { BudgetSnapshot } from "@/lib/types/finance";

interface Props {
  items: BudgetSnapshot[];
}

export function BudgetProgressSnapshot({ items }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Budget Snapshot</h3>
        <Link href="/budgets" className="text-xs text-brand-600 hover:underline font-medium">Manage</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No active budget. Set one up in Budgets.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <div key={item.categoryId}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-700 font-medium truncate">{item.categoryName}</span>
                <span className={item.isOverBudget ? "text-negative font-medium" : "text-gray-500"}>
                  {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={cn("progress-fill", item.isOverBudget ? "bg-negative" : "bg-brand-500")}
                  style={{ width: `${Math.min(100, item.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
