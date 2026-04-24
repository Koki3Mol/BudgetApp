/**
 * components/imports/import-preview-table.tsx
 *
 * Shows parsed transactions with error and duplicate summaries before committing.
 * User can review and then click Commit.
 */

"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Copy } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { ImportPreview } from "@/lib/types/finance";

interface Props {
  preview: ImportPreview;
  accountId: string;
  onCommit: (batchId: string) => void;
  onBack: () => void;
}

export function ImportPreviewTable({ preview, accountId, onCommit, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { transactions, errors, duplicates, source, fileHash, filename } = preview;

  async function handleCommit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/imports/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          source,
          accountId,
          fileHash,
          filename,
          duplicateIndices: duplicates.map((d) => d.incomingIndex),
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Commit failed."); return; }
      onCommit(json.data.batchId);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Import Preview</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length} transactions · {duplicates.length} duplicates · {errors.length} errors
          </p>
        </div>
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
          ← Back
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <span className="badge badge-success">{transactions.length} to import</span>
        {duplicates.length > 0 && <span className="badge badge-warn">{duplicates.length} duplicates skipped</span>}
        {errors.length > 0 && <span className="badge badge-error">{errors.length} errors</span>}
      </div>

      {/* Errors list */}
      {errors.length > 0 && (
        <div className="card border border-negative/20 bg-negative/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-negative" />
            <span className="text-xs font-semibold text-negative">Parse Errors</span>
          </div>
          <div className="space-y-1">
            {errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-xs text-gray-700">{e.severity.toUpperCase()}: {e.message} {e.rowIndex !== undefined ? `(row ${e.rowIndex})` : ""}</p>
            ))}
            {errors.length > 5 && <p className="text-xs text-gray-400">…and {errors.length - 5} more</p>}
          </div>
        </div>
      )}

      {/* Duplicates list */}
      {duplicates.length > 0 && (
        <div className="card border border-caution/20 bg-caution/5">
          <div className="flex items-center gap-2 mb-2">
            <Copy size={14} className="text-caution" />
            <span className="text-xs font-semibold text-caution">Duplicates (will be skipped)</span>
          </div>
          <div className="space-y-1">
            {duplicates.slice(0, 3).map((d, i) => (
              <p key={i} className="text-xs text-gray-700">
                Duplicate #{d.incomingIndex} — {d.reason}
              </p>
            ))}
            {duplicates.length > 3 && <p className="text-xs text-gray-400">…and {duplicates.length - 3} more</p>}
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 200).map((row, i) => (
              <tr key={i}>
                <td className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(row.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </td>
                <td className="max-w-xs">
                  <p className="text-sm font-medium text-gray-900 truncate">{row.cleanDescription}</p>
                  {row.merchantName && row.merchantName !== row.cleanDescription && (
                    <p className="text-xs text-gray-400 truncate">{row.merchantName}</p>
                  )}
                </td>
                <td>
                  <span className="text-xs text-gray-500">—</span>
                </td>
                <td className="text-right">
                  <span className={cn("text-sm font-medium tabular-nums", row.direction === "DEBIT" ? "amount-debit" : "amount-credit")}>
                    {row.direction === "DEBIT" ? "−" : "+"}
                    {formatCurrency(row.amount)}
                  </span>
                </td>
                <td>
                  <span className="text-xs text-gray-400">{row.type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length > 200 && (
          <p className="text-xs text-gray-400 p-3 text-center">Showing first 200 of {transactions.length}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-negative bg-negative/5 border border-negative/20 rounded-lg p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Commit */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCommit}
          disabled={loading || transactions.length === 0}
          className="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <CheckCircle size={14} />
              Commit {transactions.length} Transactions
            </>
          )}
        </button>
      </div>
    </div>
  );
}
