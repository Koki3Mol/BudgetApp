/**
 * components/imports/upload-dropzone.tsx
 *
 * Drag-and-drop file upload zone.
 * Parses the file via /api/imports/parse and calls onPreview with the result.
 *
 * Security: validates file extension and size client-side before sending.
 * Server-side re-validates independently.
 */

"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, File, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ImportPreview, ImportSource } from "@/lib/types/finance";

const ALLOWED_EXTENSIONS = [".csv", ".pdf"];
const MAX_SIZE_MB = 10;
const SOURCE_OPTIONS: { value: ImportSource | ""; label: string }[] = [
  { value: "", label: "Auto-detect" },
  { value: "SA_BANK_CSV", label: "SA Bank CSV (FNB / Nedbank / ABSA)" },
  { value: "SA_BANK_PDF", label: "SA Bank PDF Statement" },
  { value: "GOOGLE_PAY_CSV", label: "Google Pay CSV" },
  { value: "GENERIC_CSV", label: "Generic CSV (manual mapping)" },
];

interface Props {
  onPreview: (preview: ImportPreview, accountId: string) => void;
}

export function UploadDropzone({ onPreview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImportSource | "">("");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch accounts on mount
  useState(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAccounts(json.data);
          if (json.data.length > 0) setAccountId(json.data[0].id);
        }
      });
  });

  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return `Unsupported file type: ${ext}. Only CSV and PDF are accepted.`;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File exceeds ${MAX_SIZE_MB} MB limit.`;
    return null;
  }

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError("");
    setSelectedFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  async function handleParse() {
    if (!selectedFile) return;
    if (!accountId) { setError("Please select an account first (Settings > Add Account)."); return; }

    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      if (source) form.append("source", source);
      form.append("accountId", accountId);

      const res = await fetch("/api/imports/parse", { method: "POST", body: form });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Failed to parse file.");
        return;
      }
      onPreview(json.data, accountId);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Import Transactions</h2>
        <p className="text-sm text-gray-500 mt-0.5">Upload a bank statement (CSV or PDF) to import your transactions.</p>
      </div>

      {/* Dropzone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
          dragging ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-brand-300 hover:bg-gray-50",
          selectedFile ? "border-brand-300 bg-brand-50" : ""
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <File size={32} className="text-brand-500" />
            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(0)} KB</p>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="text-xs text-gray-400 hover:text-negative"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload size={32} className="text-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-700">Drop your file here, or <span className="text-brand-600">browse</span></p>
              <p className="text-xs text-gray-400 mt-1">Supports CSV and PDF · Max {MAX_SIZE_MB} MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Source Type</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as ImportSource | "")}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
          {accounts.length === 0 ? (
            <p className="text-xs text-caution-dark pt-2">No accounts — add one in <a href="/settings" className="underline">Settings</a>.</p>
          ) : (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-negative bg-negative/5 border border-negative/20 rounded-lg p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Parse button */}
      <button
        onClick={handleParse}
        disabled={!selectedFile || loading}
        className="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Parsing…" : "Parse & Preview"}
      </button>
    </div>
  );
}
