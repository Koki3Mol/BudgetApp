/**
 * app/(app)/tracking-expenses/page.tsx
 *
 * Primary dashboard: Tracking Expenses (Budgeting, Expenses, Investments)
 */

// Server component for the Tracking Expenses dashboard

import { type Metadata } from "next";
import { PortfolioAllocationChart } from "@/components/investments/portfolio-allocation-chart";
import { HoldingsTable } from "@/components/investments/holdings-table";
import { AddHoldingForm } from "@/components/investments/add-holding-form";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgressSnapshot } from "@/components/dashboard/budget-progress-snapshot";
import { ImportHealthCard } from "@/components/dashboard/import-health-card";
// client page; no extra utilities needed here

export const metadata: Metadata = { title: "Tracking Expenses" };

async function getDashboardSummary(): Promise<any | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/dashboard/summary`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function TrackingExpensesPage() {
  const summary = await getDashboardSummary();
  // Investments data
  const portfolioRes = await fetch("/api/investments/holdings");
  const portfolioJson = await portfolioRes.json();
  const portfolio = portfolioJson.success ? portfolioJson.data : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Tracking Expenses</h2>
        <span className="text-sm text-gray-500">Overview</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Budgeting: overview / snapshot */}
        <div className="lg:col-span-1">
          <BudgetProgressSnapshot items={summary?.budgetSnapshot ?? []} />
        </div>

        {/* Expenses: trend + recent transactions */}
        <div className="lg:col-span-1">
          <MonthlyTrendChart data={summary?.monthlyTrend ?? []} />
          <RecentTransactions transactions={summary?.recentTransactions ?? []} />
        </div>

        {/* Investments */}
        <div className="lg:col-span-1">
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Investments</h3>
            </div>
            <PortfolioAllocationChart allocations={portfolio?.allocations ?? []} loading={portfolio == null} />
          </div>
          <div className="card p-4">
            <HoldingsTable holdings={portfolio?.holdings ?? []} loading={portfolio == null} />
          </div>
          <div className="card p-4">
            <AddHoldingForm onSuccess={() => { /* no-op for this dashboard; Investments page handles updates */ }} />
          </div>
        </div>
      </div>

      <ImportHealthCard health={summary?.importHealth} />
    </div>
  );
}
