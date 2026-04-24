/**
 * components/budgets/budget-group-table.tsx
 *
 * A single editable budget group table (e.g. "Income", "Expenses", "Debt").
 * Shows Budget and Actual columns with a totals row.
 * Rows can be added, removed, and edited inline.
 */

"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";

export interface BudgetLine {
  id: string;           // client-side uuid
  label: string;
  categoryId?: string | null;
  budgetAmount: number;
  actualAmount: number;
}

interface Props {
  title: string;
  color: string;        // tailwind bg class for header, e.g. "bg-green-200"
  lines: BudgetLine[];
  onChange: (lines: BudgetLine[]) => void;
  /** If true, actual > budget is positive (income groups) */
  creditGroup?: boolean;
}

export function BudgetGroupTable({ title, color, lines, onChange, creditGroup = false }: Props) {
  const totalBudget = lines.reduce((s, l) => s + l.budgetAmount, 0);
  const totalActual = lines.reduce((s, l) => s + l.actualAmount, 0);

  function updateLine(id: string, field: keyof BudgetLine, value: string | number) {
    onChange(lines.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function addLine() {
    onChange([...lines, { id: crypto.randomUUID(), label: "", categoryId: null, budgetAmount: 0, actualAmount: 0 }]);
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id));
  }

  const overBudget = creditGroup ? totalActual < totalBudget : totalActual > totalBudget;

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn("px-3 py-2 grid grid-cols-[1fr_80px_80px_24px] gap-2 items-center", color)}>
        <span className="text-sm font-bold text-gray-800">{title}</span>
        <span className="text-xs font-semibold text-gray-600 text-right">Budget</span>
        <span className="text-xs font-semibold text-gray-600 text-right">Actual</span>
        <span />
      </div>

      {/* Rows */}
      {lines.map((line) => (
        <div
          key={line.id}
          className="px-3 py-1.5 grid grid-cols-[1fr_80px_80px_24px] gap-2 items-center border-t border-gray-50 hover:bg-gray-50 group"
        >
          <input
            type="text"
            value={line.label}
            onChange={(e) => updateLine(line.id, "label", e.target.value)}
            placeholder="Item name"
            className="text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:ring-0 w-full placeholder:text-gray-300"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.budgetAmount || ""}
            onChange={(e) => updateLine(line.id, "budgetAmount", parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-sm text-right bg-transparent border-none focus:outline-none focus:ring-0 w-full tabular-nums placeholder:text-gray-300"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.actualAmount || ""}
            onChange={(e) => updateLine(line.id, "actualAmount", parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={cn(
              "text-sm text-right bg-transparent border-none focus:outline-none focus:ring-0 w-full tabular-nums placeholder:text-gray-300",
              line.actualAmount === 0 ? "text-gray-300" :
              creditGroup
                ? line.actualAmount >= line.budgetAmount ? "text-green-600" : "text-orange-500"
                : line.actualAmount <= line.budgetAmount ? "text-green-600" : "text-red-500"
            )}
          />
          <button
            onClick={() => removeLine(line.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-400 transition-opacity"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {/* Add row */}
      <div className="px-3 py-1 border-t border-gray-50">
        <button
          onClick={addLine}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors"
        >
          <Plus size={12} />
          Add item
        </button>
      </div>

      {/* Totals */}
      <div className={cn(
        "px-3 py-1.5 grid grid-cols-[1fr_80px_80px_24px] gap-2 items-center border-t-2 border-gray-200",
        color,
      )}>
        <span className="text-xs font-semibold text-gray-700">Total</span>
        <span className="text-xs font-semibold text-right tabular-nums text-gray-800">
          {formatCurrency(totalBudget)}
        </span>
        <span className={cn(
          "text-xs font-semibold text-right tabular-nums",
          overBudget ? "text-red-600" : "text-green-700"
        )}>
          {formatCurrency(totalActual)}
        </span>
        <span />
      </div>
    </div>
  );
}
