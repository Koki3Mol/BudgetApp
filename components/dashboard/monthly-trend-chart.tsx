/**
 * components/dashboard/monthly-trend-chart.tsx
 *
 * Grouped bar chart: income vs expenses per month (last 6 months).
 * Includes a line for net cash flow.
 */

"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCompact } from "@/lib/utils/currency";
import type { MonthlyTrendPoint } from "@/lib/types/finance";

interface Props {
  data: MonthlyTrendPoint[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-card-hover px-3 py-2 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: { name: string; color: string; value: number }) => (
        <div key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="tabular-nums text-gray-700">{formatCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function MonthlyTrendChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Cash Flow</h3>
      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
          No transaction data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} width={56} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}
