/**
 * app/(app)/imports/page.tsx
 *
 * Imports page — upload zone, parser selection, preview table, commit.
 * Client component because it manages upload state.
 */

"use client";

import { useState } from "react";
import { UploadDropzone } from "@/components/imports/upload-dropzone";
import { ImportPreviewTable } from "@/components/imports/import-preview-table";
import { ImportHistory } from "@/components/imports/import-history";
import type { ImportPreview } from "@/lib/types/finance";

type PageState = "idle" | "previewing" | "committed";

export default function ImportsPage() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [committedBatchId, setCommittedBatchId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0); // force re-fetch history after commit

  function handlePreview(data: ImportPreview, accId: string) {
    setPreview(data);
    setAccountId(accId);
    setPageState("previewing");
  }

  function handleCommitted(batchId: string) {
    setCommittedBatchId(batchId);
    setPageState("committed");
    setHistoryKey((k) => k + 1);
    setPreview(null);
  }

  function handleReset() {
    setPreview(null);
    setPageState("idle");
    setCommittedBatchId(null);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {pageState === "idle" && (
        <UploadDropzone onPreview={handlePreview} />
      )}

      {pageState === "previewing" && preview && (
        <ImportPreviewTable
          preview={preview}
          accountId={accountId}
          onCommit={handleCommitted}
          onBack={handleReset}
        />
      )}

      {pageState === "committed" && (
        <div className="card text-center py-10">
          <div className="text-positive text-4xl mb-3">✓</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Import Complete</h2>
          <p className="text-sm text-gray-500 mb-4">Batch ID: {committedBatchId}</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Import history always visible below */}
      <ImportHistory key={historyKey} />
    </div>
  );
}
