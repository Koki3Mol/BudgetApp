/**
 * app/(app)/tracking-expenses/page.tsx
 * Client component: Tracking Expenses dashboard
 */

"use client";

import { useEffect, useState } from "react";
import { PortfolioAllocationChart } from "@/components/investments/portfolio-allocation-chart";
import { HoldingsTable } from "@/components/investments/holdings-table";
import { AddHoldingForm } from "@/components/investments/add-holding-form";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetProgressSnapshot } from "@/components/dashboard/budget-progress-snapshot";
import { ImportHealthCard } from "@/components/dashboard/import-health-card";


type DashboardSummary = any;
type PortfolioData = any;

export default function TrackingExpensesPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  async function loadSummary() {
    try {
      const res = await fetch(`${baseUrl}/api/dashboard/summary`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setSummary(json.data);
      }
    } catch {
      // ignore
    }
  }

  async function loadPortfolio() {
    try {
      const res = await fetch(`${baseUrl}/api/investments/holdings`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) setPortfolio(json.data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadSummary();
    loadPortfolio();
  }, []);

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
            <AddHoldingForm onSuccess={() => { loadPortfolio(); loadSummary(); }} />
          </div>
        </div>
      </div>

      <ImportHealthCard health={summary?.importHealth} />
    </div>
  );
}
