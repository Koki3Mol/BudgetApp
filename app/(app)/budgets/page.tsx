/**
 * app/(app)/budgets/page.tsx
 *
 * Monthly budget planner modelled after the screenshot.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Save, RefreshCw } from "lucide-react";
import { BudgetGroupTable, type BudgetLine } from "@/components/budgets/budget-group-table";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

interface ActualEntry {
  categoryId: string;
  categoryName: string;
  debit: number;
  credit: number;
}

interface ActualsResponse {
  totalIn: number;
  totalOut: number;
  remaining: number;
  actuals: ActualEntry[];
}

interface GroupState {
  name: string;
  color: string;
  creditGroup: boolean;
  lines: BudgetLine[];
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function todayYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function makeDefaultGroups(): GroupState[] {
  return [
    { name: "Income",            color: "bg-green-100",  creditGroup: true,  lines: [{ id: crypto.randomUUID(), label: "Salary",        categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
    { name: "Fixed Expenses",    color: "bg-orange-100", creditGroup: false, lines: [{ id: crypto.randomUUID(), label: "Rent",          categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
    { name: "Variable Expenses", color: "bg-orange-100", creditGroup: false, lines: [{ id: crypto.randomUUID(), label: "Groceries",     categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
    { name: "Subscriptions",     color: "bg-green-100",  creditGroup: false, lines: [{ id: crypto.randomUUID(), label: "Streaming",     categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
    { name: "Debt",              color: "bg-green-100",  creditGroup: false, lines: [{ id: crypto.randomUUID(), label: "Credit Card",   categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
    { name: "Investments",       color: "bg-green-100",  creditGroup: false, lines: [{ id: crypto.randomUUID(), label: "Investment",    categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
    { name: "Savings",           color: "bg-pink-100",   creditGroup: false, lines: [{ id: crypto.randomUUID(), label: "Emergency Fund",categoryId: null, budgetAmount: 0, actualAmount: 0 }] },
  ];
}

function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">No data</div>;
  let cumAngle = -Math.PI / 2;
  const cx = 70; const cy = 70; const r = 60;
  const paths = slices.filter(s => s.value > 0).map((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const midAngle = cumAngle - angle / 2;
    const lx = cx + (r + 18) * Math.cos(midAngle);
    const ly = cy + (r + 18) * Math.sin(midAngle);
    const pct = ((sl.value / total) * 100).toFixed(1);
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: sl.color, label: sl.label, pct, lx, ly };
  });
  return (
    <svg viewBox="0 0 200 140" className="w-full max-w-[200px]">
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={1} />)}
      {paths.map((p, i) => (
        <text key={i} x={p.lx} y={p.ly} textAnchor="middle" fontSize={7} fill="#4b5563">
          {p.pct}%
        </text>
      ))}
    </svg>
  );
}

function BarChart({ bars }: { bars: { label: string; budget: number; actual: number }[] }) {
  if (bars.length === 0) return <div className="text-xs text-gray-300 py-2 text-center">No data</div>;
  const max = Math.max(...bars.flatMap((b) => [b.budget, b.actual]), 1);
  const chartH = 60; const barW = 10; const gap = 3; const groupGap = 6;
  const totalW = Math.max(bars.length * (barW * 2 + gap + groupGap), 40);
  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 20}`} className="w-full" style={{ maxHeight: 90 }}>
      {bars.map((b, i) => {
        const x = i * (barW * 2 + gap + groupGap);
        const bH = (b.budget / max) * chartH;
        const aH = (b.actual / max) * chartH;
        return (
          <g key={i}>
            <rect x={x} y={chartH - bH} width={barW} height={bH} fill="#f97316" rx={1.5} />
            <rect x={x + barW + gap} y={chartH - aH} width={barW} height={aH} fill="#60a5fa" rx={1.5} />
            <text x={x + barW} y={chartH + 8} textAnchor="middle" fontSize={4.5} fill="#9ca3af">{b.label.slice(0, 7)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function BudgetsPage() {
  const { year: todayYear, month: todayMonth } = todayYM();
  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [groups, setGroups] = useState<GroupState[]>(makeDefaultGroups);
  const [actuals, setActuals] = useState<ActualsResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, actualsRes] = await Promise.all([
      fetch(`/api/budgets/monthly?year=${year}&month=${month}`).then(r => r.json()),
      fetch(`/api/budgets/monthly/actuals?year=${year}&month=${month}`).then(r => r.json()),
    ]);
    setLoading(false);

    if (actualsRes.success) setActuals(actualsRes.data);

    const actualByName = new Map<string, ActualEntry>();
    if (actualsRes.success) {
      for (const a of actualsRes.data.actuals as ActualEntry[]) {
        actualByName.set(a.categoryName.toLowerCase(), a);
      }
    }

    if (planRes.success && planRes.data) {
      const savedGroups: { name: string; items: { label: string; categoryId?: string | null; budgetAmount: number }[] }[] = planRes.data.groups;
      const merged: GroupState[] = savedGroups.map((sg) => {
        const meta = makeDefaultGroups().find(d => d.name === sg.name) ?? { color: "bg-gray-100", creditGroup: false };
        return {
          name: sg.name,
          color: meta.color,
          creditGroup: meta.creditGroup,
          lines: sg.items.map(item => {
            const actual = actualByName.get(item.label.toLowerCase());
            const isCredit = meta.creditGroup;
            return {
              id: crypto.randomUUID(),
              label: item.label,
              categoryId: item.categoryId ?? null,
              budgetAmount: item.budgetAmount,
              actualAmount: isCredit ? (actual?.credit ?? 0) : (actual?.debit ?? 0),
            };
          }),
        };
      });
      setGroups(merged);
    } else {
      setGroups(makeDefaultGroups().map(g => ({
        ...g,
        lines: g.lines.map(l => {
          const actual = actualByName.get(l.label.toLowerCase());
          return { ...l, actualAmount: g.creditGroup ? (actual?.credit ?? 0) : (actual?.debit ?? 0) };
        }),
      })));
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    await fetch("/api/budgets/monthly", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
        groups: groups.map(g => ({
          name: g.name,
          items: g.lines.map(l => ({ label: l.label, categoryId: l.categoryId, budgetAmount: l.budgetAmount })),
        })),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateGroup(idx: number, lines: BudgetLine[]) {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, lines } : g));
  }

  const incomeGroup = groups.find(g => g.name === "Income");
  const totalBudgetIn = incomeGroup?.lines.reduce((s, l) => s + l.budgetAmount, 0) ?? 0;
  const totalBudgetOut = groups.filter(g => !g.creditGroup).reduce((s, g) => s + g.lines.reduce((ss, l) => ss + l.budgetAmount, 0), 0);
  // Banner is driven by live budget inputs so it updates as you type
  const totalActualIn = incomeGroup?.lines.reduce((s, l) => s + l.actualAmount, 0) ?? 0;
  const totalActualOut = groups.filter(g => !g.creditGroup).reduce((s, g) => s + g.lines.reduce((ss, l) => ss + l.actualAmount, 0), 0);
  const remaining = totalBudgetIn - totalBudgetOut;

  const pieSlices = groups.filter(g => !g.creditGroup).map((g, i) => {
    const COLORS = ["#f97316","#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444"];
    return { label: g.name, value: g.lines.reduce((s, l) => s + l.actualAmount, 0), color: COLORS[i % COLORS.length] };
  });

  const varGroup = groups.find(g => g.name === "Variable Expenses");
  const barBars = (varGroup?.lines ?? []).map(l => ({ label: l.label, budget: l.budgetAmount, actual: l.actualAmount }));

  const left = groups.slice(0, Math.ceil(groups.length / 2));
  const right = groups.slice(Math.ceil(groups.length / 2));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-pink-50 rounded-xl px-3 py-2 min-w-[160px]">
            <button onClick={prevMonth} className="p-0.5 rounded hover:bg-pink-100 text-gray-500">
              <ChevronLeft size={16} />
            </button>
            <span className="flex-1 text-center font-semibold text-gray-800 text-lg">
              {MONTH_NAMES[month - 1]}
            </span>
            <button onClick={nextMonth} className="p-0.5 rounded hover:bg-pink-100 text-gray-500">
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-sm text-gray-400">{year}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              saved ? "bg-green-600 text-white" : "bg-brand-600 text-white hover:bg-brand-700",
              saving && "opacity-60"
            )}
          >
            <Save size={14} />
            {saving ? "Saving..." : saved ? "Saved!" : "Save Budget"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card py-3 text-center bg-yellow-50 border border-yellow-100">
          <p className="text-xs text-gray-500 mb-0.5">Money In</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalBudgetIn)}</p>
          {totalActualIn > 0 && <p className="text-xs text-gray-400">Actual: {formatCurrency(totalActualIn)}</p>}
        </div>
        <div className="card py-3 text-center bg-yellow-50 border border-yellow-100">
          <p className="text-xs text-gray-500 mb-0.5">Money Out</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totalBudgetOut)}</p>
          {totalActualOut > 0 && <p className="text-xs text-gray-400">Actual: {formatCurrency(totalActualOut)}</p>}
        </div>
        <div className={cn("card py-3 text-center border", remaining >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
          <p className="text-xs text-gray-500 mb-0.5">Remaining</p>
          <p className={cn("text-lg font-bold", remaining >= 0 ? "text-green-700" : "text-red-600")}>{formatCurrency(remaining)}</p>
          {totalActualIn > 0 && <p className="text-xs text-gray-400">Actual: {formatCurrency(totalActualIn - totalActualOut)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          {left.map((g, i) => (
            <BudgetGroupTable
              key={g.name}
              title={g.name}
              color={g.color}
              lines={g.lines}
              creditGroup={g.creditGroup}
              onChange={(lines) => updateGroup(i, lines)}
            />
          ))}
        </div>
        <div className="space-y-4">
          {right.map((g, i) => (
            <BudgetGroupTable
              key={g.name}
              title={g.name}
              color={g.color}
              lines={g.lines}
              creditGroup={g.creditGroup}
              onChange={(lines) => updateGroup(left.length + i, lines)}
            />
          ))}
        </div>
        <div className="space-y-4">
          <div className="card">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Income Distribution</h4>
            <div className="flex justify-center">
              <PieChart slices={pieSlices} />
            </div>
            <div className="mt-3 space-y-1">
              {pieSlices.filter(s => s.value > 0).map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-gray-600 flex-1 truncate">{s.label}</span>
                  <span className="text-xs text-gray-500 tabular-nums">{formatCurrency(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
          {barBars.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-800 mb-1">Variable Expenses</h4>
              <div className="flex gap-3 mb-2">
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /><span className="text-xs text-gray-500">Actual</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /><span className="text-xs text-gray-500">Budget</span></div>
              </div>
              <BarChart bars={barBars} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
