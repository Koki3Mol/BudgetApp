/**
 * components/investments/portfolio-allocation-chart.tsx
 */

"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { AllocationSlice } from "@/lib/types/finance";

interface Props {
  allocations: AllocationSlice[];
  loading: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as AllocationSlice;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.assetType}</p>
      <p className="text-gray-600">{formatCurrency(d.value)} ({d.pct.toFixed(1)}%)</p>
    </div>
  );
}

export function PortfolioAllocationChart({ allocations, loading }: Props) {
  return (
    <div className="card h-full">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Allocation</h3>
      {loading ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">Loading…</div>
      ) : allocations.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-28 h-28 rounded-full border-[12px] border-gray-100 flex items-center justify-center">
            <span className="text-xs text-gray-400 text-center">No<br/>holdings</span>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={allocations}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {allocations.map((a) => (
                <Cell key={a.assetType} fill={a.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(_, entry) => (
                <span className="text-xs text-gray-600">{(entry.payload as AllocationSlice).assetType}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
