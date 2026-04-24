/**
 * components/dashboard/recent-transactions.tsx
 */

"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import type { Transaction } from "@/lib/types/finance";

interface Props {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
        <Link href="/transactions" className="text-xs text-brand-600 hover:underline font-medium">
          View all
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No transactions yet. Import a statement to get started.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5">
              {/* Category color dot */}
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                style={{ background: tx.categoryColor ?? "#d1d5db" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {tx.merchantName ?? tx.cleanDescription}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(tx.date)} · {tx.categoryName ?? "Uncategorized"}
                </p>
              </div>
              <span className={tx.direction === "DEBIT" ? "amount-debit text-sm" : "amount-credit text-sm"}>
                {tx.direction === "DEBIT" ? "−" : "+"}
                {formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}
