/**
 * lib/importers/genericCsvParser.ts
 *
 * Fallback generic CSV parser. The caller provides a GenericCsvColumnMap
 * describing which columns correspond to which normalized fields.
 *
 * Flow:
 * 1. Client uploads CSV and selects "Generic CSV" source.
 * 2. API returns the detected column names.
 * 3. User maps columns to normalized fields (UI step).
 * 4. User submits the mapping, and parse() is called with it.
 *
 * This parser is also the fallback when no other parser claims the file.
 * In that case it tries to auto-map common column names.
 */

import Papa from "papaparse";
import { parse as parseDateFns, isValid } from "date-fns";
import type { StatementParser, ParseResult, ParsedRow, RawRow, GenericCsvColumnMap } from "./types";
import type { ImportSource } from "@/lib/types/finance";
import { computeTransactionHash } from "@/lib/finance/dedupe";
import { cleanDescription, inferTransactionType } from "@/lib/finance/normalize";
import { computeFileHash } from "@/lib/utils/hash";

const FALLBACK_DATE_FORMATS = [
  "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd",
  "dd MMM yyyy", "d MMM yyyy", "dd-MM-yyyy",
];

// Common column name guesses for auto-mapping
const AUTO_DATE_COLS = ["date", "transaction date", "trans date", "value date"];
const AUTO_DESC_COLS = ["description", "narration", "details", "merchant", "reference", "memo"];
const AUTO_AMOUNT_COLS = ["amount", "transaction amount", "value"];
const AUTO_DEBIT_COLS = ["debit", "debit amount", "withdrawals"];
const AUTO_CREDIT_COLS = ["credit", "credit amount", "deposits"];
const AUTO_BALANCE_COLS = ["balance", "running balance", "available balance"];

export class GenericCsvParser implements StatementParser {
  readonly name = "Generic CSV";
  readonly source: ImportSource = "GENERIC_CSV";

  /** Column map injected by caller; undefined for auto-detect mode */
  private columnMap?: GenericCsvColumnMap;

  withColumnMap(map: GenericCsvColumnMap): GenericCsvParser {
    const instance = new GenericCsvParser();
    instance.columnMap = map;
    return instance;
  }

  async canHandle(_filename: string, _buffer: Buffer): Promise<boolean> {
    // GenericCsvParser is always a fallback — return true for any CSV
    return _filename.toLowerCase().endsWith(".csv");
  }

  async parse(filename: string, buffer: Buffer): Promise<ParseResult> {
    const fileHash = computeFileHash(buffer);
    const csvText = buffer.toString("utf-8");

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    const headers = parsed.meta.fields ?? [];
    const map = this.columnMap ?? autoDetectColumns(headers);

    if (!map.date || !map.description) {
      return {
        source: this.source,
        fileHash,
        rows: [],
        errors: [{ severity: "error", code: "UNMAPPABLE_CSV", message: "Cannot auto-detect required date or description columns. Use manual column mapping." }],
        totalRows: 0,
      };
    }

    const rows: ParsedRow[] = [];
    let statementFrom: Date | undefined;
    let statementTo: Date | undefined;
    let totalRows = 0;

    for (const [i, record] of parsed.data.entries()) {
      totalRows++;
      const rawRow: RawRow = { rowIndex: i, fields: record };

      const rawDate = record[map.date]?.trim() ?? "";
      const dateObj = parseFlexDate(rawDate, map.dateFormat);
      if (!dateObj) {
        rows.push({ rawRow, error: { rowIndex: i, severity: "error", code: "INVALID_DATE", message: `Cannot parse date: "${rawDate}"` } });
        continue;
      }

      if (!statementFrom || dateObj < statementFrom) statementFrom = dateObj;
      if (!statementTo || dateObj > statementTo) statementTo = dateObj;

      // Determine amount + direction
      let amount: number;
      let direction: "DEBIT" | "CREDIT";

      if (map.debitAmount && map.creditAmount) {
        // Separate debit/credit columns
        const debitRaw = record[map.debitAmount]?.trim() ?? "";
        const creditRaw = record[map.creditAmount]?.trim() ?? "";
        const debitVal = debitRaw ? parseFloat(debitRaw.replace(/[^\d.-]/g, "")) : NaN;
        const creditVal = creditRaw ? parseFloat(creditRaw.replace(/[^\d.-]/g, "")) : NaN;

        if (!isNaN(debitVal) && debitVal > 0) {
          amount = debitVal;
          direction = "DEBIT";
        } else if (!isNaN(creditVal) && creditVal > 0) {
          amount = creditVal;
          direction = "CREDIT";
        } else {
          rows.push({ rawRow, error: { rowIndex: i, severity: "warning", code: "ZERO_AMOUNT", message: "Row has no debit or credit amount" } });
          continue;
        }
      } else if (map.amount) {
        const rawAmt = record[map.amount]?.trim() ?? "";
        const mode = map.directionMode ?? "sign";
        const parsed = parseAmountWithMode(rawAmt, mode, map.directionColumn ? record[map.directionColumn] : undefined);
        if (isNaN(parsed.amount)) {
          rows.push({ rawRow, error: { rowIndex: i, severity: "error", code: "INVALID_AMOUNT", message: `Cannot parse amount: "${rawAmt}"` } });
          continue;
        }
        amount = Math.abs(parsed.amount);
        direction = parsed.direction;
      } else {
        rows.push({ rawRow, error: { rowIndex: i, severity: "error", code: "NO_AMOUNT_COL", message: "No amount column configured" } });
        continue;
      }

      const rawBalance = map.balance ? record[map.balance]?.trim() : undefined;
      const balance = rawBalance ? parseFloat(rawBalance.replace(/[^\d.,-]/g, "")) : undefined;

      const rawDesc = record[map.description]?.trim() ?? "";
      const refNum = map.referenceNumber ? record[map.referenceNumber]?.trim() : undefined;

      const dedupeHash = computeTransactionHash({
        date: dateObj.toISOString().split("T")[0],
        amount,
        direction,
        accountId: "GENERIC",
        rawDescription: rawDesc,
        currency: "ZAR",
      });

      rows.push({
        rawRow,
        normalized: {
          date: dateObj.toISOString().split("T")[0],
          amount,
          currency: "ZAR",
          direction,
          type: inferTransactionType({ direction, rawDescription: rawDesc }),
          rawDescription: rawDesc,
          cleanDescription: cleanDescription(rawDesc),
          referenceNumber: refNum,
          balance: balance !== undefined && !isNaN(balance) ? balance : undefined,
          dedupeHash,
        },
      });
    }

    return {
      source: this.source,
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

function autoDetectColumns(headers: string[]): Partial<GenericCsvColumnMap> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx !== -1) return headers[idx];
    }
    return undefined;
  };
  return {
    date: find(AUTO_DATE_COLS),
    description: find(AUTO_DESC_COLS),
    amount: find(AUTO_AMOUNT_COLS),
    debitAmount: find(AUTO_DEBIT_COLS),
    creditAmount: find(AUTO_CREDIT_COLS),
    balance: find(AUTO_BALANCE_COLS),
    directionMode: "sign",
  };
}

function parseFlexDate(raw: string, fmt?: string): Date | null {
  const formats = fmt ? [fmt, ...FALLBACK_DATE_FORMATS] : FALLBACK_DATE_FORMATS;
  for (const f of formats) {
    const d = parseDateFns(raw, f, new Date());
    if (isValid(d)) return d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmountWithMode(
  raw: string,
  mode: "sign" | "suffix" | "column",
  directionColValue?: string
): { amount: number; direction: "DEBIT" | "CREDIT" } {
  let str = raw.replace(/[, ]/g, "");
  let direction: "DEBIT" | "CREDIT" = "DEBIT";

  if (mode === "suffix") {
    if (str.endsWith("-")) {
      direction = "DEBIT";
      str = str.slice(0, -1);
    } else {
      direction = "CREDIT";
    }
  } else if (mode === "column") {
    const col = directionColValue?.toLowerCase().trim() ?? "";
    direction = col === "credit" || col === "cr" ? "CREDIT" : "DEBIT";
  } else {
    // sign mode
    const val = parseFloat(str);
    direction = val < 0 ? "DEBIT" : "CREDIT";
  }

  return { amount: parseFloat(str.replace("-", "")), direction };
}
