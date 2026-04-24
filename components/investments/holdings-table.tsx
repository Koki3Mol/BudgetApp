/**
 * components/investments/holdings-table.tsx
 */

"use client";

import { formatCurrency, formatCompact } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { Holding } from "@/lib/types/finance";

interface Props {
  holdings: Holding[];
  loading: boolean;
}

export function HoldingsTable({ holdings, loading }: Props) {
  if (loading) return <div className="card py-12 text-center text-sm text-gray-400">Loading…</div>;
  if (holdings.length === 0) return (
    <div className="card py-12 text-center">
      <p className="text-sm font-medium text-gray-600">No holdings yet</p>
      <p className="text-xs text-gray-400 mt-1">Add your first holding below.</p>
    </div>
  );

  return (
    <div className="card p-0">
      <div className="table-container rounded-xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="text-right">Units</th>
              <th className="text-right">Avg Cost</th>
              <th className="text-right">Current</th>
              <th className="text-right">Value</th>
              <th className="text-right">Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const gain = (h.currentValue ?? h.totalCost) - h.totalCost;
              const gainPct = h.totalCost > 0 ? (gain / h.totalCost) * 100 : 0;
              return (
                <tr key={h.id}>
                  <td>
                    <p className="text-sm font-semibold text-gray-900">{h.asset.symbol ?? h.asset.name}</p>
                    <p className="text-xs text-gray-400">{h.asset.name} · {h.asset.assetType}</p>
                  </td>
                  <td className="text-right text-sm tabular-nums">{h.quantity.toLocaleString()}</td>
                  <td className="text-right text-sm tabular-nums">{formatCurrency(h.averageCost)}</td>
                  <td className="text-right text-sm tabular-nums">
                    {h.latestPrice ? formatCurrency(h.latestPrice) : "—"}
                  </td>
                  <td className="text-right text-sm font-semibold tabular-nums">
                    {h.currentValue ? formatCompact(h.currentValue) : "—"}
                  </td>
                  <td className="text-right">
                    <p className={cn("text-sm font-semibold tabular-nums", gain >= 0 ? "text-positive" : "text-negative")}>
                      {gain >= 0 ? "+" : ""}{formatCompact(gain)}
                    </p>
                    <p className={cn("text-xs tabular-nums", gain >= 0 ? "text-positive" : "text-negative")}>
                      {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(2)}%
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
