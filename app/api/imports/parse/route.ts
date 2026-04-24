/**
 * app/api/imports/parse/route.ts
 *
 * POST /api/imports/parse
 *
 * Accepts a multipart file upload, parses it through the importer pipeline,
 * and returns a preview of the parsed transactions with duplicates flagged.
 * Does NOT write to the database — that happens at /api/imports/commit.
 *
 * Security:
 * - File size limit: 10 MB (enforced before parsing)
 * - MIME type validation: only PDF and CSV allowed
 * - File content is parsed in-memory; never written to disk in this route
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveParser } from "@/lib/importers/registry";
import { detectDuplicateCandidates } from "@/lib/finance/dedupe";
import type { ImportSource, ImportPreview, ApiResponse } from "@/lib/types/finance";

const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? "10485760");
const ALLOWED_MIME = ["text/csv", "application/csv", "application/pdf", "text/plain"];
const ALLOWED_EXT = [".csv", ".pdf"];

// Hardcoded single-user ID for MVP (no auth yet)
const SYSTEM_USER_ID = "default";

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ImportPreview>>> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const sourceOverride = formData.get("source") as ImportSource | null;
  const accountId = formData.get("accountId") as string | null;

  if (!file) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ success: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB` }, { status: 413 });
  }

  // Extension check
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ success: false, error: "Unsupported file type. Only CSV and PDF are accepted." }, { status: 415 });
  }

  // MIME check (browsers may send application/octet-stream for CSV downloads)
  const mime = file.type.toLowerCase();
  if (mime && mime !== "application/octet-stream" && !ALLOWED_MIME.some((m) => mime.startsWith(m))) {
    // Warn but don't block — MIME can be unreliable for CSV files
    console.warn(`[import/parse] Unexpected MIME type: ${mime} for file ${file.name}`);
  }

  // Read buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Resolve parser
  const parser = await resolveParser(file.name, buffer, sourceOverride ?? undefined);
  if (!parser) {
    return NextResponse.json({ success: false, error: "Could not determine a parser for this file. Try selecting a source type manually." }, { status: 422 });
  }

  // Parse
  const parseResult = await parser.parse(file.name, buffer);

  // Check for existing file hash (exact duplicate upload)
  const existingBatch = await db.importBatch.findFirst({
    where: { fileHash: parseResult.fileHash, userId: SYSTEM_USER_ID },
    select: { id: true, createdAt: true },
  });
  if (existingBatch) {
    return NextResponse.json({
      success: false,
      error: `This exact file was already imported on ${existingBatch.createdAt.toLocaleDateString("en-ZA")}. Import batch ID: ${existingBatch.id}`,
      code: "DUPLICATE_FILE",
    }, { status: 409 });
  }

  // Fetch existing dedupe hashes for this account (or all accounts for this user)
  const where = accountId
    ? { accountId, userId: SYSTEM_USER_ID }
    : { userId: SYSTEM_USER_ID };
  const existingTxs = await db.transaction.findMany({
    where,
    select: { dedupeHash: true, id: true },
  });
  const existingHashMap = new Map(existingTxs.map((t) => [t.dedupeHash, t.id]));

  // Extract normalized transactions from parse result
  const normalized = parseResult.rows
    .filter((r) => r.normalized)
    .map((r) => r.normalized!);

  // Detect duplicates
  const duplicates = detectDuplicateCandidates({ incoming: normalized, existingHashes: existingHashMap });

  const errorRows = parseResult.rows.filter((r) => r.error).length;

  const preview: ImportPreview = {
    source: parseResult.source,
    filename: file.name,
    fileHash: parseResult.fileHash,
    statementFrom: parseResult.statementFrom?.toISOString().split("T")[0],
    statementTo: parseResult.statementTo?.toISOString().split("T")[0],
    accountHint: parseResult.accountHint,
    transactions: normalized,
    errors: parseResult.errors,
    duplicates,
    totalRows: parseResult.totalRows,
    validRows: normalized.length,
    errorRows,
  };

  return NextResponse.json({ success: true, data: preview });
}
