/**
 * app/(app)/transactions/page.tsx
 *
 * Transactions list with search, filters, and inline category editing.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";

export interface TxFilter {
  search: string;
  categoryId: string;
  direction: "" | "DEBIT" | "CREDIT";
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: TxFilter = { search: "", categoryId: "", direction: "", dateFrom: "", dateTo: "" };

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TxFilter>(DEFAULT_FILTERS);
  const [transactions, setTransactions] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    params.set("page", String(page));
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      if (json.success) {
        // Flatten nested `category` object into top-level fields expected by the table
        const flat = json.data.transactions.map((tx: {
          category?: { id: string; name: string; color?: string };
          [key: string]: unknown;
        }) => ({
          ...tx,
          categoryName: tx.category?.name,
          categoryColor: tx.category?.color,
        }));
        setTransactions(flat);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filters]);

  return (
    <div className="space-y-4 animate-fade-in">
      <TransactionFilters filters={filters} onChange={setFilters} />
      <TransactionsTable
        transactions={transactions as never[]}
        total={total}
        page={page}
        onPageChange={setPage}
        loading={loading}
        onRefresh={fetchTransactions}
      />
    </div>
  );
}
