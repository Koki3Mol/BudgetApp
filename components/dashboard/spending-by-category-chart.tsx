/**
 * components/dashboard/spending-by-category-chart.tsx
 *
 * Donut chart of spending by category using Recharts.
 *
 * Data shape: CategorySpend[]
 * Interaction: hover shows tooltip with amount + percentage.
 * Empty state: renders a placeholder donut with "No Data" label.
 */

"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategorySpend } from "@/lib/types/finance";

interface Props {
  data: CategorySpend[];
}

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCustomLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, pct } = props;
  if (pct < 5) return null; // Skip labels for tiny slices
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${Math.round(pct)}%`}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as CategorySpend;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-card-hover px-3 py-2 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.categoryColor }} />
        <span className="font-semibold text-gray-900">{d.categoryName}</span>
      </div>
      <div className="text-gray-600">{formatCurrency(d.amount)} ({d.pct.toFixed(1)}%)</div>
      <div className="text-gray-400">{d.transactionCount} transactions</div>
    </div>
  );
}

export function SpendingByCategoryChart({ data }: Props) {
  return (
    <div className="card h-full">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Spending by Category</h3>
      {data.length === 0 ? (
        <EmptyDonut />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="amount"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.categoryColor} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value, entry) => (
                <span className="text-xs text-gray-600">{(entry.payload as CategorySpend).categoryName}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EmptyDonut() {
  return (
    <div className="flex items-center justify-center h-[240px]">
      <div className="w-32 h-32 rounded-full border-[12px] border-gray-100 flex items-center justify-center">
        <span className="text-xs text-gray-400 text-center leading-tight">No data<br />yet</span>
      </div>
    </div>
  );
}
