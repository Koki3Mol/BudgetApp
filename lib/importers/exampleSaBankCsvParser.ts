/**
 * lib/importers/exampleSaBankCsvParser.ts
 *
 * Parser for First National Bank (FNB) SA CSV statement exports.
 *
 * Assumptions about FNB CSV format (based on real-world FNB exports):
 * - Header row: "Date","Description","Amount","Balance","Accrued bank charges",…
 * - Date format: "01 Jan 2024" (dd MMM yyyy)
 * - Amount: negative = debit, positive = credit
 * - Balance: running balance column (may be empty mid-statement)
 * - File may contain preamble rows (account number line, etc.) before the header
 *
 * If your bank uses a different CSV shape, add a new parser class
 * and register it in lib/importers/registry.ts.
 */

import Papa from "papaparse";
import { parse as parseDateFns, isValid } from "date-fns";
import type { StatementParser, ParseResult, ParsedRow, RawRow } from "./types";
import type { ImportSource } from "@/lib/types/finance";
import { computeTransactionHash } from "@/lib/finance/dedupe";
import { cleanDescription, inferTransactionType } from "@/lib/finance/normalize";
import { computeFileHash } from "@/lib/utils/hash";

// FNB CSV expected column names (case-insensitive)
const FNB_DATE_COL = "date";
const FNB_DESC_COL = "description";
const FNB_AMOUNT_COL = "amount";
const FNB_BALANCE_COL = "balance";

// Date formats to try in order (date-fns format strings)
const SA_DATE_FORMATS = [
  "dd MMM yyyy",   // 01 Jan 2024
  "d MMM yyyy",    // 1 Jan 2024
  "dd/MM/yyyy",    // 01/01/2024
  "yyyy-MM-dd",    // 2024-01-01
  "d/M/yyyy",      // 1/1/2024
  "yyyyMMdd",      // 20240101 (compact format used by some SA banks)
];

export class ExampleSaBankCsvParser implements StatementParser {
  readonly name = "FNB / SA Bank CSV";
  readonly source: ImportSource = "SA_BANK_CSV";

  async canHandle(filename: string, buffer: Buffer): Promise<boolean> {
    if (!filename.toLowerCase().endsWith(".csv")) return false;

    const head = buffer.slice(0, 1024).toString("utf-8").toLowerCase();
    // FNB CSVs typically have these columns and often a preamble with account info
    return (
      head.includes("description") &&
      head.includes("amount") &&
      (head.includes("balance") || head.includes("fnb") || head.includes("first national"))
    );
  }

  async parse(filename: string, buffer: Buffer): Promise<ParseResult> {
    const fileHash = computeFileHash(buffer);
    const rawText = buffer.toString("utf-8");

    // FNB CSVs have preamble lines (account name, number, etc.) before the data header.
    // We skip lines until we find the header row containing "Date" and "Description".
    const lines = rawText.split(/\r?\n/);
    let headerLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("date") && lower.includes("description") && lower.includes("amount")) {
        headerLineIdx = i;
        break;
      }
    }

    // Extract account hint from preamble
    let accountHint: string | undefined;
    for (let i = 0; i < Math.min(headerLineIdx, 10); i++) {
      const line = lines[i];
      // FNB preamble contains "Account Number,XXXXXXXX" or similar
      const accMatch = line.match(/account[^,]*,\s*(\d[\d\s*]+)/i);
      if (accMatch) {
        const digits = accMatch[1].replace(/\s/g, "");
        accountHint = `****${digits.slice(-4)}`;
        break;
      }
    }

    if (headerLineIdx === -1) {
      return {
        source: this.source,
        fileHash,
        rows: [],
        errors: [{ severity: "error", code: "NO_HEADER", message: "Could not find CSV header row with Date/Description/Amount columns." }],
        totalRows: 0,
      };
    }

    const dataText = lines.slice(headerLineIdx).join("\n");

    const parsed = Papa.parse<Record<string, string>>(dataText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const rows: ParsedRow[] = [];
    let statementFrom: Date | undefined;
    let statementTo: Date | undefined;
    let totalRows = 0;

    for (const [i, record] of parsed.data.entries()) {
      totalRows++;
      const rawRow: RawRow = { rowIndex: headerLineIdx + 1 + i, fields: record };

      // Skip obviously empty rows
      if (!record[FNB_DATE_COL] && !record[FNB_AMOUNT_COL]) continue;

      // Parse date
      const rawDate = record[FNB_DATE_COL]?.trim() ?? "";
      const dateObj = parseSaDate(rawDate);
      if (!dateObj) {
        rows.push({
          rawRow,
          error: {
            rowIndex: rawRow.rowIndex,
            severity: "error",
            code: "INVALID_DATE",
            message: `Cannot parse date: "${rawDate}"`,
          },
        });
        continue;
      }

      // Track statement period
      if (!statementFrom || dateObj < statementFrom) statementFrom = dateObj;
      if (!statementTo || dateObj > statementTo) statementTo = dateObj;

      // Parse amount
      const rawAmount = record[FNB_AMOUNT_COL]?.trim() ?? "";
      const amount = parseSaAmount(rawAmount);
      if (isNaN(amount)) {
        rows.push({
          rawRow,
          error: {
            rowIndex: rawRow.rowIndex,
            severity: "error",
            code: "INVALID_AMOUNT",
            message: `Cannot parse amount: "${rawAmount}"`,
          },
        });
        continue;
      }

      const direction = amount < 0 ? "DEBIT" : "CREDIT";
      const absAmount = Math.abs(amount);

      // Parse balance (optional)
      const rawBalance = record[FNB_BALANCE_COL]?.trim();
      const balance = rawBalance ? parseSaAmount(rawBalance) : undefined;

      const rawDesc = record[FNB_DESC_COL]?.trim() ?? "";

      const dedupeHash = computeTransactionHash({
        date: dateObj.toISOString().split("T")[0],
        amount: absAmount,
        direction,
        accountId: accountHint ?? "SA_BANK",
        rawDescription: rawDesc,
        currency: "ZAR",
      });

      rows.push({
        rawRow,
        normalized: {
          date: dateObj.toISOString().split("T")[0],
          amount: absAmount,
          currency: "ZAR",
          direction,
          type: inferTransactionType({ direction, rawDescription: rawDesc }),
          rawDescription: rawDesc,
          cleanDescription: cleanDescription(rawDesc),
          balance: isNaN(balance ?? NaN) ? undefined : balance,
          dedupeHash,
        },
      });
    }

    return {
      source: this.source,
      institutionHint: "FNB",
      accountHint,
      statementFrom,
      statementTo,
      fileHash,
      rows,
      errors: rows.flatMap((r) => (r.error ? [r.error] : [])),
      totalRows,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSaDate(raw: string): Date | null {
  for (const fmt of SA_DATE_FORMATS) {
    const d = parseDateFns(raw, fmt, new Date());
    if (isValid(d)) return d;
  }
  // Last resort: native parse
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse SA bank amounts:
 * - "1 234.56"    → 1234.56 (space as thousands sep)
 * - "-1 234.56"   → -1234.56
 * - "1 234.56-"   → -1234.56 (trailing minus = debit on some banks)
 * - "1,234.56"    → 1234.56
 */
function parseSaAmount(raw: string): number {
  let str = raw.trim();
  // Trailing minus
  const trailingMinus = str.endsWith("-");
  if (trailingMinus) str = str.slice(0, -1);
  // Remove thousands separators (space or comma)
  str = str.replace(/[\s,]/g, "");
  const val = parseFloat(str);
  return trailingMinus ? -Math.abs(val) : val;
}
