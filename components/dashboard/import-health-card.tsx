/**
 * components/dashboard/import-health-card.tsx
 */

"use client";

import Link from "next/link";
import { CheckCircle, AlertCircle } from "lucide-react";
import type { ImportHealth } from "@/lib/types/finance";

interface Props {
  health?: ImportHealth;
}

export function ImportHealthCard({ health }: Props) {
  const issues = health
    ? health.uncategorizedCount + health.duplicatesDetected + health.recentErrors
    : 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Import Health</h3>
        <Link href="/imports" className="text-xs text-brand-600 hover:underline font-medium">View</Link>
      </div>
      {!health ? (
        <p className="text-xs text-gray-400 py-2">No imports yet.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {issues === 0 ? (
              <CheckCircle size={14} className="text-positive shrink-0" />
            ) : (
              <AlertCircle size={14} className="text-caution shrink-0" />
            )}
            <span className="text-gray-700">{health.totalBatches} imports total</span>
          </div>
          {health.uncategorizedCount > 0 && (
            <p className="text-xs text-caution-dark">⚠ {health.uncategorizedCount} uncategorized transactions</p>
          )}
          {health.duplicatesDetected > 0 && (
            <p className="text-xs text-gray-500">ⓘ {health.duplicatesDetected} duplicates skipped</p>
          )}
          {health.recentErrors > 0 && (
            <p className="text-xs text-negative">✕ {health.recentErrors} import errors</p>
          )}
          {health.lastImportDate && (
            <p className="text-xs text-gray-400">
              Last import: {new Date(health.lastImportDate).toLocaleDateString("en-ZA")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
