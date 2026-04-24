/**
 * lib/importers/googlePayCsvParser.ts
 *
 * Parses Google Pay transaction history CSV exports.
 *
 * Assumption: Google Pay exports a CSV with at least these columns
 * (actual column names observed from Google Pay export):
 *   Date, Transaction ID, Description, Amount, Currency, Status, Payment Method
 *
 * Dates are in ISO format "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD".
 * Amounts include currency prefix: "ZAR 250.00" or just "-250.00".
 * Status: we only import "Completed" transactions.
 *
 * Column name matching is case-insensitive to handle minor export variations.
 */

import Papa from "papaparse";
import type { StatementParser, ParseResult, ParsedRow, RawRow } from "./types";
import type { ImportSource } from "@/lib/types/finance";
import { computeTransactionHash } from "@/lib/finance/dedupe";
import { cleanDescription, inferTransactionType } from "@/lib/finance/normalize";
import { computeFileHash } from "@/lib/utils/hash";

// Known column names (lower-cased) that Google Pay uses
const DATE_COLS = ["date", "transaction date"];
const DESC_COLS = ["description", "merchant", "title"];
const AMOUNT_COLS = ["amount", "transaction amount"];
const CURRENCY_COLS = ["currency", "transaction currency"];
const STATUS_COLS = ["status", "transaction status"];
const ID_COLS = ["transaction id", "id"];

function findCol(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

export class GooglePayCsvParser implements StatementParser {
  readonly name = "Google Pay CSV";
  readonly source: ImportSource = "GOOGLE_PAY_CSV";

  async canHandle(filename: string, buffer: Buffer): Promise<boolean> {
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".csv")) return false;

    // Quick content sniff: look for Google Pay signature columns
    const head = buffer.slice(0, 512).toString("utf-8");
    const lowerHead = head.toLowerCase();
    return (
      (lowerHead.includes("transaction id") || lowerHead.includes("google pay")) &&
      lowerHead.includes("description") &&
      lowerHead.includes("amount")
    );
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
    const dateCol = findCol(headers, DATE_COLS);
    const descCol = findCol(headers, DESC_COLS);
    const amountCol = findCol(headers, AMOUNT_COLS);
    const currencyCol = findCol(headers, CURRENCY_COLS);
    const statusCol = findCol(headers, STATUS_COLS);
    const idCol = findCol(headers, ID_COLS);

    const rows: ParsedRow[] = [];
    let statementFrom: Date | undefined;
    let statementTo: Date | undefined;
    let totalRows = 0;

    for (const [i, record] of parsed.data.entries()) {
      totalRows++;

      // Skip non-completed transactions
      if (statusCol) {
        const status = record[statusCol]?.trim().toLowerCase();
        if (status && status !== "completed") {
          rows.push({
            rawRow: { rowIndex: i, fields: record },
            error: {
              rowIndex: i,
              severity: "warning",
              code: "SKIPPED_STATUS",
              message: `Skipped: status is "${record[statusCol]}"`,
            },
          });
          continue;
        }
      }

      // Parse date
      if (!dateCol || !record[dateCol]) {
        rows.push({
          rawRow: { rowIndex: i, fields: record },
          error: {
            rowIndex: i,
            severity: "error",
            code: "MISSING_DATE",
            message: "Row has no date value",
          },
        });
        continue;
      }

      const rawDate = record[dateCol].trim();
      const dateObj = parseGooglePayDate(rawDate);
      if (!dateObj) {
        rows.push({
          rawRow: { rowIndex: i, fields: record },
          error: {
            rowIndex: i,
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

      // Parse amount + currency
      if (!amountCol || !record[amountCol]) {
        rows.push({
          rawRow: { rowIndex: i, fields: record },
          error: {
            rowIndex: i,
            severity: "error",
            code: "MISSING_AMOUNT",
            message: "Row has no amount value",
          },
        });
        continue;
      }

      const { amount, currency } = parseGooglePayAmount(
        record[amountCol],
        currencyCol ? record[currencyCol] : undefined
      );

      if (isNaN(amount)) {
        rows.push({
          rawRow: { rowIndex: i, fields: record },
          error: {
            rowIndex: i,
            severity: "error",
            code: "INVALID_AMOUNT",
            message: `Cannot parse amount: "${record[amountCol]}"`,
          },
        });
        continue;
      }

      // Direction: Google Pay amounts are negative for payments, positive for refunds
      const direction = amount < 0 ? "DEBIT" : "CREDIT";
      const absAmount = Math.abs(amount);

      const rawDesc = descCol ? (record[descCol]?.trim() ?? "") : "";
      const referenceNumber = idCol ? record[idCol]?.trim() : undefined;

      // Placeholder — accountId is supplied at commit time
      const dedupeHash = computeTransactionHash({
        date: dateObj.toISOString().split("T")[0],
        amount: absAmount,
        direction,
        accountId: "GOOGLE_PAY",
        rawDescription: rawDesc,
        currency,
      });

      const rawRow: RawRow = { rowIndex: i, fields: record };

      rows.push({
        rawRow,
        normalized: {
          date: dateObj.toISOString().split("T")[0],
          amount: absAmount,
          currency,
          direction,
          type: inferTransactionType({ direction, rawDescription: rawDesc }),
          rawDescription: rawDesc,
          cleanDescription: cleanDescription(rawDesc),
          referenceNumber,
          dedupeHash,
        },
      });
    }

    return {
      source: "GOOGLE_PAY_CSV",
      institutionHint: "Google Pay",
      accountHint: "Google Pay",
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

function parseGooglePayDate(raw: string): Date | null {
  // Handles: "2024-03-15 14:30:00", "2024-03-15", "Mar 15, 2024"
  const isoFull = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoFull) {
    const d = new Date(isoFull[1] + "T00:00:00.000Z");
    return isNaN(d.getTime()) ? null : d;
  }
  // Try direct parse as fallback
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses amounts like: "ZAR 250.00", "-250.00", "250.00 ZAR", "R250.00"
 * Returns { amount: signed float, currency: string }
 */
function parseGooglePayAmount(
  raw: string,
  currencyHint?: string
): { amount: number; currency: string } {
  let str = raw.trim();
  let currency = currencyHint?.trim().toUpperCase() ?? "ZAR";

  // Strip known currency prefixes/suffixes
  const currencyPrefixMatch = str.match(/^([A-Z]{3})\s*([-\d.,]+)/i);
  const currencySuffixMatch = str.match(/([-\d.,]+)\s*([A-Z]{3})$/i);
  const randPrefix = str.match(/^R\s*([-\d.,]+)/i);

  if (currencyPrefixMatch) {
    currency = currencyPrefixMatch[1].toUpperCase();
    str = currencyPrefixMatch[2];
  } else if (currencySuffixMatch) {
    str = currencySuffixMatch[1];
    currency = currencySuffixMatch[2].toUpperCase();
  } else if (randPrefix) {
    currency = "ZAR";
    str = randPrefix[1];
  }

  // Remove commas (thousands separators)
  str = str.replace(/,/g, "");

  // Handle trailing minus: "250.00-" → -250.00
  if (str.endsWith("-")) {
    str = "-" + str.slice(0, -1);
  }

  return { amount: parseFloat(str), currency };
}
