/**
 * components/dashboard/summary-cards.tsx
 *
 * Four stat cards: Total Income, Total Expenses, Net Cash Flow, Net Worth.
 */

"use client";

import { TrendingUp, TrendingDown, ArrowLeftRight, Landmark } from "lucide-react";
import { formatCompact } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { DashboardSummary } from "@/lib/types/finance";

interface Props {
  summary: DashboardSummary | null;
}

export function SummaryCards({ summary }: Props) {
  const cards = [
    {
      label: "Total Income",
      value: summary?.totalIncome ?? 0,
      icon: TrendingUp,
      iconColor: "text-positive",
      iconBg: "bg-positive/10",
      valueColor: "text-positive",
    },
    {
      label: "Total Expenses",
      value: summary?.totalExpenses ?? 0,
      icon: TrendingDown,
      iconColor: "text-negative",
      iconBg: "bg-negative/10",
      valueColor: "text-negative",
    },
    {
      label: "Net Cash Flow",
      value: summary?.netCashFlow ?? 0,
      icon: ArrowLeftRight,
      iconColor: (summary?.netCashFlow ?? 0) >= 0 ? "text-positive" : "text-negative",
      iconBg: (summary?.netCashFlow ?? 0) >= 0 ? "bg-positive/10" : "bg-negative/10",
      valueColor: (summary?.netCashFlow ?? 0) >= 0 ? "text-positive" : "text-negative",
      showSign: true,
    },
    {
      label: "Net Worth",
      value: summary?.netWorthSnapshot.netWorth ?? 0,
      icon: Landmark,
      iconColor: "text-brand-500",
      iconBg: "bg-brand-50",
      valueColor: "text-gray-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {card.label}
              </span>
              <span className={cn("p-2 rounded-lg", card.iconBg)}>
                <Icon size={14} className={card.iconColor} />
              </span>
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", card.valueColor)}>
              {summary === null ? (
                <span className="text-gray-300 animate-pulse">—</span>
              ) : (
                <>
                  {card.showSign && card.value >= 0 ? "+" : ""}
                  {formatCompact(card.value)}
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
