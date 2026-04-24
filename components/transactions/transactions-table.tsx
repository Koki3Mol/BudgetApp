/**
 * components/transactions/transactions-table.tsx
 *
 * Paginated table with inline category editing on every row.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { Pencil, Check, X } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  cleanDescription: string;
  merchantName?: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  type: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryLocked: boolean;
}

interface Category { id: string; name: string; color?: string; icon?: string }

interface Props {
  transactions: Transaction[];
  total: number;
  page: number;
  onPageChange: (p: number) => void;
  loading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

export function TransactionsTable({ transactions, total, page, onPageChange, loading, onRefresh }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);
  // New category inline form
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [creatingCat, setCreatingCat] = useState(false);
  const [catError, setCatError] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  function loadCategories() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCategories(json.data); });
  }

  useEffect(() => { loadCategories(); }, []);

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setPendingCategory(tx.categoryId ?? "");
    setAddingCategory(false);
    setTimeout(() => selectRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setPendingCategory("");
    setAddingCategory(false);
    setNewCatName("");
    setCatError("");
  }

  async function saveCategory(txId: string) {
    setSaving(txId);
    setEditingId(null);
    setAddingCategory(false);
    try {
      await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: pendingCategory || null }),
      });
      onRefresh();
    } finally {
      setSaving(null);
      setPendingCategory("");
    }
  }

  async function createCategory(txId: string) {
    const name = newCatName.trim();
    if (!name) { setCatError("Enter a name"); return; }
    setCreatingCat(true);
    setCatError("");
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newCatColor }),
    });
    const json = await res.json();
    setCreatingCat(false);
    if (!json.success) { setCatError(json.error ?? "Failed"); return; }
    // Reload categories, select the new one, and save
    loadCategories();
    setPendingCategory(json.data.id);
    setAddingCategory(false);
    setNewCatName("");
    // Auto-save with new category
    setSaving(txId);
    setEditingId(null);
    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: json.data.id }),
    });
    setSaving(null);
    onRefresh();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="card p-0">
      {loading && (
        <div className="px-4 py-2 bg-brand-50 text-xs text-brand-700 border-b border-brand-100 text-center">
          Loading...
        </div>
      )}
      <div className="table-container rounded-xl overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="text-center text-sm text-gray-400 py-12">
                  No transactions found. Try adjusting your filters.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="group">
                  <td className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="max-w-[220px]">
                    <p className="text-sm font-medium text-gray-900 truncate" title={tx.cleanDescription}>
                      {tx.merchantName ?? tx.cleanDescription}
                    </p>
                    {tx.merchantName && tx.merchantName !== tx.cleanDescription && (
                      <p className="text-xs text-gray-400 truncate">{tx.cleanDescription}</p>
                    )}
                  </td>
                  <td className="min-w-[200px]">
                    {editingId === tx.id ? (
                      /* Inline edit mode */
                      <div className="flex flex-col gap-1.5">
                        {addingCategory ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              ref={newCatInputRef}
                              autoFocus
                              type="text"
                              placeholder="Category name"
                              value={newCatName}
                              onChange={(e) => { setNewCatName(e.target.value); setCatError(""); }}
                              onKeyDown={(e) => { if (e.key === "Enter") createCategory(tx.id); if (e.key === "Escape") setAddingCategory(false); }}
                              className="text-xs rounded border border-gray-200 px-1.5 py-1 w-32 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                            />
                            <input
                              type="color"
                              value={newCatColor}
                              onChange={(e) => setNewCatColor(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                              title="Pick colour"
                            />
                            <button
                              onClick={() => createCategory(tx.id)}
                              disabled={creatingCat}
                              className="p-1 rounded text-positive hover:bg-green-50 disabled:opacity-50"
                              title="Create and assign"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setAddingCategory(false); setCatError(""); }}
                              className="p-1 rounded text-gray-400 hover:bg-gray-100"
                              title="Back"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            {catError && <span className="text-xs text-red-500">{catError}</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select
                              ref={selectRef}
                              value={pendingCategory}
                              onChange={(e) => {
                                if (e.target.value === "__new__") {
                                  setAddingCategory(true);
                                  setTimeout(() => newCatInputRef.current?.focus(), 0);
                                } else {
                                  setPendingCategory(e.target.value);
                                }
                              }}
                              className="text-xs rounded border border-gray-200 px-1.5 py-1 focus:ring-2 focus:ring-brand-500 focus:outline-none max-w-[150px]"
                            >
                              <option value="">Uncategorized</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                              <option value="__new__">+ New category...</option>
                            </select>
                            <button
                              onClick={() => saveCategory(tx.id)}
                              className="p-1 rounded text-positive hover:bg-green-50"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 rounded text-gray-400 hover:bg-gray-100"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* â”€â”€ Display mode â€” always shows category + edit button â”€â”€ */
                      <div className="flex items-center gap-1.5">
                        {tx.categoryColor ? (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: tx.categoryColor }}
                          />
                        ) : (
                          <span className="w-2 h-2 rounded-full shrink-0 bg-gray-200" />
                        )}
                        <span className={cn(
                          "text-xs",
                          tx.categoryName ? "text-gray-700" : "text-gray-400 italic"
                        )}>
                          {saving === tx.id ? "Saving..." : (tx.categoryName ?? "Uncategorized")}
                        </span>
                        <button
                          onClick={() => startEdit(tx)}
                          disabled={saving === tx.id}
                          className="ml-0.5 p-0.5 rounded text-gray-300 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Change category"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {tx.categoryLocked && (
                          <span className="text-[10px] text-gray-300" title="Manually set">[L]</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="text-xs text-gray-400">{tx.type}</span>
                  </td>
                  <td className="text-right">
                    <span className={cn("text-sm font-semibold tabular-nums", tx.direction === "DEBIT" ? "amount-debit" : "amount-credit")}>
                      {tx.direction === "DEBIT" ? "-" : "+"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
          <p className="text-xs text-gray-500">
            {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="text-xs px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="text-xs px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
