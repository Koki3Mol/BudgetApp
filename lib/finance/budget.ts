/**
 * lib/finance/budget.ts
 *
 * Budget suggestion algorithm.
 *
 * Method: Trimmed Mean
 * ---------------------
 * We use a 20% trimmed mean on monthly spending per category.
 * This means we sort monthly totals, remove the top and bottom 10%,
 * then average the middle 80%.
 *
 * Why trimmed mean over median?
 * - Median ignores magnitude of outlier months (e.g. a R10,000 month vs R1,000).
 * - Simple mean is skewed by one-off large expenses.
 * - Trimmed mean is robust to outliers while still weighting actual spend levels.
 * - It works well with as few as 3 months of data.
 *
 * Fallback: if fewer than 3 monthly samples exist, we use a simple mean.
 * We add a 5% buffer to the suggestion to give the user breathing room.
 */

import type { BudgetSuggestion } from "@/lib/types/finance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlySpendRecord {
  categoryId: string;
  categoryName: string;
  /** YYYY-MM string */
  month: string;
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Derives budget suggestions from historical monthly spending.
 *
 * @param records - Aggregated spending per category per month (DEBIT only)
 * @param trimFraction - Fraction to trim from each tail (default 0.1 = 10%)
 * @param bufferPct - % buffer added to suggestion (default 0.05 = 5%)
 */
export function suggestBudgets(
  records: MonthlySpendRecord[],
  trimFraction = 0.1,
  bufferPct = 0.05
): BudgetSuggestion[] {
  // Group by category
  const byCategory = new Map<string, MonthlySpendRecord[]>();
  for (const r of records) {
    if (!byCategory.has(r.categoryId)) byCategory.set(r.categoryId, []);
    byCategory.get(r.categoryId)!.push(r);
  }

  const suggestions: BudgetSuggestion[] = [];

  for (const [categoryId, monthRecords] of byCategory.entries()) {
    const amounts = monthRecords.map((r) => r.totalAmount).sort((a, b) => a - b);
    const sampleCount = amounts.length;
    const categoryName = monthRecords[0].categoryName;

    let suggestedAmount: number;
    let method: "trimmed_mean" | "median";
    let historicalAvg: number;

    if (sampleCount < 3) {
      // Not enough data for trimming — use simple mean
      historicalAvg = amounts.reduce((s, v) => s + v, 0) / sampleCount;
      suggestedAmount = Math.ceil(historicalAvg * (1 + bufferPct));
      method = "median";
    } else {
      // Trimmed mean
      const trimCount = Math.floor(sampleCount * trimFraction);
      const trimmed = amounts.slice(trimCount, sampleCount - trimCount);
      historicalAvg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
      // Apply buffer and round up to nearest 50 ZAR for cleaner budget numbers
      suggestedAmount = roundUpTo50(historicalAvg * (1 + bufferPct));
      method = "trimmed_mean";
    }

    suggestions.push({
      categoryId,
      categoryName,
      suggestedAmount,
      method,
      sampleCount,
      historicalAvg: Math.round(historicalAvg * 100) / 100,
    });
  }

  // Sort by suggested amount descending (biggest spend categories first)
  return suggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount);
}

function roundUpTo50(value: number): number {
  return Math.ceil(value / 50) * 50;
}

// ---------------------------------------------------------------------------
// Budget vs Actual computation
// ---------------------------------------------------------------------------

export interface BudgetActualRow {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgeted: number;
  actual: number;
}

export function computeBudgetVsActual(
  budgetItems: Array<{ categoryId: string; amount: number }>,
  actualSpend: Map<string, number>, // categoryId → total spend
  categoryMeta: Map<string, { name: string; color: string }>
): BudgetActualRow[] {
  return budgetItems.map((item) => {
    const meta = categoryMeta.get(item.categoryId);
    const actual = actualSpend.get(item.categoryId) ?? 0;
    return {
      categoryId: item.categoryId,
      categoryName: meta?.name ?? "Unknown",
      categoryColor: meta?.color ?? "#6b7280",
      budgeted: item.amount,
      actual,
    };
  });
}
