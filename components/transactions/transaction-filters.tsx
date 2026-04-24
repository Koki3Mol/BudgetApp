/**
 * components/transactions/transaction-filters.tsx
 */

"use client";

import { useEffect, useState } from "react";
import { Search, Filter } from "lucide-react";
import type { TxFilter } from "@/app/(app)/transactions/page";

interface Category { id: string; name: string; color?: string }

interface Props {
  filters: TxFilter;
  onChange: (f: TxFilter) => void;
}

export function TransactionFilters({ filters, onChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch("/api/transactions?limit=0")
      .then((r) => r.json())
      .then((json) => {
        if (json.success?.categories) setCategories(json.success.categories);
      });
    // Separately fetch categories if the transactions endpoint doesn't expose them
    fetch("/api/budgets/suggest?months=1")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const cats: Category[] = json.data.map((s: { categoryId: string; categoryName: string }) => ({
            id: s.categoryId,
            name: s.categoryName,
          }));
          setCategories(cats);
        }
      });
  }, []);

  function set<K extends keyof TxFilter>(key: K, value: TxFilter[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search transactions…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
        {/* Direction */}
        <select
          value={filters.direction}
          onChange={(e) => set("direction", e.target.value as TxFilter["direction"])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
        >
          <option value="">All</option>
          <option value="DEBIT">Expenses</option>
          <option value="CREDIT">Income</option>
        </select>
        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2"
        >
          <Filter size={12} />
          Filters
        </button>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-gray-50">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set("dateFrom", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set("dateTo", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => onChange({ search: "", categoryId: "", direction: "", dateFrom: "", dateTo: "" })}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
