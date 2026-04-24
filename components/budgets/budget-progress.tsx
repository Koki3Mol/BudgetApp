/**
 * components/budgets/budget-progress.tsx
 */

"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { BudgetSuggestion } from "@/lib/types/finance";

interface Props {
  suggestions: BudgetSuggestion[];
}

export function BudgetProgress({ suggestions }: Props) {
  return (
    <div className="card divide-y divide-gray-50">
      {suggestions.map((s) => {
        const pct = s.suggestedAmount > 0 ? Math.min(100, (s.historicalAvg / s.suggestedAmount) * 100) : 0;
        const over = s.historicalAvg > s.suggestedAmount;
        return (
          <div key={s.categoryId} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: "#6366f1" }}
                />
                <span className="text-sm font-medium text-gray-900">{s.categoryName}</span>
              </div>
              <div className="text-right">
                <span className={cn("text-sm font-semibold tabular-nums", over ? "text-negative" : "text-gray-700")}>
                  {formatCurrency(s.historicalAvg)}
                </span>
                <span className="text-xs text-gray-400 ml-1">
                  / {formatCurrency(s.suggestedAmount)} suggested
                </span>
              </div>
            </div>
            <div className="progress-bar">
              <div
                className={cn("progress-fill transition-all", over ? "bg-negative" : "bg-brand-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">
                Based on {s.sampleCount} month{s.sampleCount !== 1 ? "s" : ""} of data
              </span>
              <span className={cn("text-xs font-medium", over ? "text-negative" : "text-positive")}>
                {over ? `R${(s.historicalAvg - s.suggestedAmount).toFixed(0)} over` : `R${(s.suggestedAmount - s.historicalAvg).toFixed(0)} under`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
