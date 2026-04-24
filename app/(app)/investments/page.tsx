/**
 * app/(app)/investments/page.tsx
 *
 * Investments page — portfolio summary, allocation chart, holdings table, add holding.
 */

"use client";

import { useEffect, useState } from "react";
import { PortfolioAllocationChart } from "@/components/investments/portfolio-allocation-chart";
import { HoldingsTable } from "@/components/investments/holdings-table";
import { AddHoldingForm } from "@/components/investments/add-holding-form";
import { formatCurrency, formatCompact } from "@/lib/utils/currency";
import type { PortfolioSummary } from "@/lib/types/finance";

export default function InvestmentsPage() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function fetchPortfolio() {
    setLoading(true);
    try {
      const res = await fetch("/api/investments/holdings");
      const json = await res.json();
      if (json.success) setPortfolio(json.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPortfolio(); }, []);

  const gain = portfolio?.unrealizedGain ?? 0;
  const gainPct = portfolio?.unrealizedGainPct ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? "—" : formatCompact(portfolio?.totalValue ?? 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Cost Basis</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? "—" : formatCompact(portfolio?.totalCost ?? 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Unrealized Gain</p>
          <p className={`text-2xl font-bold ${gain >= 0 ? "text-positive" : "text-negative"}`}>
            {loading ? "—" : (gain >= 0 ? "+" : "") + formatCompact(gain)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Return</p>
          <p className={`text-2xl font-bold ${gainPct >= 0 ? "text-positive" : "text-negative"}`}>
            {loading ? "—" : `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`}
          </p>
        </div>
      </div>

      {/* Charts + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PortfolioAllocationChart allocations={portfolio?.allocations ?? []} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <HoldingsTable holdings={portfolio?.holdings ?? []} loading={loading} />
        </div>
      </div>

      {/* Add holding */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Add / Update Holding</h3>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-brand-600 font-medium hover:underline"
          >
            {showAdd ? "Cancel" : "+ Add Holding"}
          </button>
        </div>
        {showAdd && (
          <AddHoldingForm
            onSuccess={() => { setShowAdd(false); fetchPortfolio(); }}
          />
        )}
      </div>
    </div>
  );
}
