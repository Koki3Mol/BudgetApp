/**
 * components/imports/import-history.tsx
 */

"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ImportBatch {
  id: string;
  fileName?: string;
  source: string;
  status: string;
  transactionCount: number;
  errorCount: number;
  createdAt: string;
}

export function ImportHistory() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [working, setWorking] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/imports?page=1&limit=20")
      .then((r) => r.json())
      .then((json) => { if (json.success) setBatches(json.data.batches); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function deleteBatch(id: string) {
    setWorking(true);
    await fetch(`/api/imports/${id}`, { method: "DELETE" });
    setDeleteConfirmId(null);
    setWorking(false);
    load();
  }

  async function clearAll() {
    setWorking(true);
    await fetch("/api/imports", { method: "DELETE" });
    setClearConfirm(false);
    setWorking(false);
    load();
  }

  if (loading) return <div className="card py-8 text-center text-sm text-gray-400">Loading history…</div>;

  if (batches.length === 0) return (
    <div className="card py-8 text-center">
      <p className="text-sm text-gray-500">No imports yet</p>
    </div>
  );

  return (
    <div className="card divide-y divide-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-sm font-semibold text-gray-900">Import History</h3>
        {clearConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Delete all data?</span>
            <button
              onClick={clearAll}
              disabled={working}
              className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {working ? "Deleting…" : "Yes, clear all"}
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="text-xs px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setClearConfirm(true)}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
          >
            <Trash2 size={13} />
            Clear all data
          </button>
        )}
      </div>

      {/* Rows */}
      {batches.map((b) => (
        <div key={b.id} className="py-3">
          {deleteConfirmId === b.id ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700 truncate">
                Delete <span className="font-medium">{b.fileName ?? "this import"}</span> and its transactions?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => deleteBatch(b.id)}
                  disabled={working}
                  className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {working ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="text-xs px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 group">
              <StatusIcon status={b.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{b.fileName ?? "Untitled"}</p>
                <p className="text-xs text-gray-500">{b.source} · {b.transactionCount} transactions</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleDateString("en-ZA")}</p>
                {b.errorCount > 0 && <p className="text-xs text-negative">{b.errorCount} errors</p>}
              </div>
              <button
                onClick={() => setDeleteConfirmId(b.id)}
                className={cn(
                  "p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors",
                  "opacity-0 group-hover:opacity-100",
                )}
                title="Delete this import"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED") return <CheckCircle size={16} className="text-positive shrink-0" />;
  if (status === "FAILED") return <AlertCircle size={16} className="text-negative shrink-0" />;
  return <Clock size={16} className="text-caution shrink-0" />;
}

