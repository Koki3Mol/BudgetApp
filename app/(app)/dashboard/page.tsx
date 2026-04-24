/**
 * app/(app)/dashboard/page.tsx
 *
 * Dashboard page — fetches summary data server-side and renders:
 * - Stat cards (income, expenses, net cash flow, net worth)
 * - Category spending donut chart
 * - Monthly trend bar chart
 * - Recent transactions list
 * - Budget progress snapshot
 * - Import health panel
 */

import type { Metadata } from "next";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { SpendingByCategoryChart } from "@/components/dashboard/spending-by-category-chart";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgressSnapshot } from "@/components/dashboard/budget-progress-snapshot";
import { ImportHealthCard } from "@/components/dashboard/import-health-card";
import type { DashboardSummary } from "@/lib/types/finance";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    // In production use absolute URL; locally we call the API route directly
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/dashboard/summary`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Period header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {summary
              ? `${formatDate(summary.period.from)} — ${formatDate(summary.period.to)}`
              : "Current Month"}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <SummaryCards summary={summary} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <MonthlyTrendChart data={summary?.monthlyTrend ?? []} />
        </div>
        <div className="lg:col-span-2">
          <SpendingByCategoryChart data={summary?.topCategories ?? []} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentTransactions transactions={summary?.recentTransactions ?? []} />
        </div>
        <div className="space-y-4">
          <BudgetProgressSnapshot items={summary?.budgetSnapshot ?? []} />
          <ImportHealthCard health={summary?.importHealth} />
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}
