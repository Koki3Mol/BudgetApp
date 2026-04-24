/**
 * lib/importers/exampleSaBankPdfParser.ts
 *
 * Parser for South African bank PDF statements.
 * Uses pdf-parse (Node.js only — runs in API routes, not in browser).
 *
 * Assumptions (based on FNB/Nedbank/ABSA PDF statement conventions):
 * - Transactions appear as lines: <date> <description> <amount> [<balance>]
 * - Date format: "01 Jan 2024" or "01/01/2024"
 * - Amounts: may be in a debit column or credit column, or a signed single value
 * - Page headers/footers contain: "Page X of Y", bank name, account number
 * - Multi-line transaction descriptions exist: continuation lines have no date/amount
 *
 * This parser uses regex-based line parsing rather than positional column extraction.
 * For production-grade PDF parsing, consider pdfjs-dist or a structured PDF table
 * extractor. pdf-parse gives us plain text which works for most SA bank PDFs.
 *
 * IMPORTANT: pdf-parse must only be imported on the server side.
 */

import type { StatementParser, ParseResult, ParsedRow, RawRow } from "./types";
import type { ImportSource } from "@/lib/types/finance";
import { computeTransactionHash } from "@/lib/finance/dedupe";
import { cleanDescription, inferTransactionType } from "@/lib/finance/normalize";
import { computeFileHash } from "@/lib/utils/hash";
import { parse as parseDateFns, isValid } from "date-fns";

const SA_DATE_FORMATS = [
  "dd MMM yyyy",
  "d MMM yyyy",
  "dd/MM/yyyy",
  "d/M/yyyy",
  "yyyy-MM-dd",
  "yyyyMMdd",
];

// Regex: date at start of line, e.g. "01 Jan 2024" or "01/01/2024"
const DATE_PATTERN = /^(\d{1,2}[\s/]\w{3,}[\s/]\d{2,4}|\d{1,2}\/\d{1,2}\/\d{4})/;

// Regex for a money amount anywhere in the text (handles "1 234.56", "-1234.56", "1,234.56-")
const AMOUNT_PATTERN = /([-]?\s?\d[\d\s,]*\.\d{2}-?)/g;

// Lines to skip (page headers/footers)
const SKIP_PATTERNS = [
  /page\s+\d+\s+of\s+\d+/i,
  /statement\s+of\s+account/i,
  /account\s+number/i,
  /opening\s+balance/i,
  /closing\s+balance/i,
  /brought\s+forward/i,
  /carried\s+forward/i,
  /^date\s+description/i,    // column header
  /^\s*$/,                    // blank line
];

export class ExampleSaBankPdfParser implements StatementParser {
  readonly name = "SA Bank PDF Statement";
  readonly source: ImportSource = "SA_BANK_PDF";

  async canHandle(filename: string, _buffer: Buffer): Promise<boolean> {
    return filename.toLowerCase().endsWith(".pdf");
  }

  async parse(filename: string, buffer: Buffer): Promise<ParseResult> {
    const fileHash = computeFileHash(buffer);

    // Dynamically import pdf-parse (v2) to avoid it being bundled client-side
    let PDFParseClass: new (opts: { data: Buffer; verbosity: number }) => { getText(): Promise<{ text: string }> };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("pdf-parse");
      PDFParseClass = mod.PDFParse;
      if (typeof PDFParseClass !== "function") throw new Error("PDFParse not found in module");
    } catch {
      return {
        source: this.source,
        fileHash,
        rows: [],
        errors: [{ severity: "error", code: "PDF_PARSE_UNAVAILABLE", message: "pdf-parse module is not available." }],
        totalRows: 0,
      };
    }

    let pdfData: { text: string };
    try {
      const parser = new PDFParseClass({ data: buffer, verbosity: 0 });
      pdfData = await parser.getText();
    } catch (err) {
      return {
        source: this.source,
        fileHash,
        rows: [],
        errors: [{ severity: "error", code: "PDF_PARSE_ERROR", message: `Failed to extract PDF text: ${String(err)}` }],
        totalRows: 0,
      };
    }

    const lines = pdfData.text.split(/\r?\n/);
    const rows: ParsedRow[] = [];
    let statementFrom: Date | undefined;
    let statementTo: Date | undefined;
    let accountHint: string | undefined;
    let prevBalance: number | undefined; // track running balance to infer debit/credit
    let totalRows = 0;

    // Try to extract account number from first few pages
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const accMatch = lines[i].match(/account\s*(?:number|no\.?)[\s:]+(\d[\d\s*]+)/i);
      if (accMatch) {
        const digits = accMatch[1].replace(/\s/g, "");
        accountHint = `****${digits.slice(-4)}`;
        break;
      }
    }

    // Parse transaction lines
    // State: accumulate continuation lines for multi-line descriptions
    let pendingDate: Date | null = null;
    let pendingDesc = "";
    let pendingAmounts: string[] = [];
    let pendingLineIdx = -1;

    const flushPending = (rowIndex: number) => {
      if (!pendingDate || pendingAmounts.length === 0) return;

      // Determine debit and credit from amount columns
      // Strategy: if 2+ amounts, first = transaction amount, last = running balance
      // If 1 amount, treat as signed value (trailing minus = debit)
      let amount = 0;
      let balance: number | undefined;

      if (pendingAmounts.length >= 2) {
        balance = parseSaAmount(pendingAmounts[pendingAmounts.length - 1]);
        amount = parseSaAmount(pendingAmounts[0]);
      } else {
        amount = parseSaAmount(pendingAmounts[0]);
      }

      if (isNaN(amount)) return;

      // Determine direction:
      // 1. If amount is explicitly negative (signed or trailing-minus) → DEBIT
      // 2. If we have a running balance and previous balance → use balance change
      // 3. Fall back: positive = CREDIT
      let direction: "DEBIT" | "CREDIT";
      if (amount < 0) {
        direction = "DEBIT";
      } else if (
        balance !== undefined &&
        !isNaN(balance) &&
        prevBalance !== undefined
      ) {
        // Balance went down → money left → DEBIT; went up → money arrived → CREDIT
        direction = balance < prevBalance ? "DEBIT" : "CREDIT";
      } else {
        // No sign info, no prev balance: default to DEBIT (most transactions are spend)
        direction = "DEBIT";
      }

      // Update running balance tracker for the next transaction
      if (balance !== undefined && !isNaN(balance)) {
        prevBalance = balance;
      }

      const absAmount = Math.abs(amount);
      const rawDesc = pendingDesc.trim();

      const dateStr = pendingDate.toISOString().split("T")[0];
      const dedupeHash = computeTransactionHash({
        date: dateStr,
        amount: absAmount,
        direction,
        accountId: accountHint ?? "SA_BANK_PDF",
        rawDescription: rawDesc,
        currency: "ZAR",
      });

      rows.push({
        rawRow: { rowIndex, fields: { date: dateStr, description: rawDesc, amounts: pendingAmounts.join("|") } },
        normalized: {
          date: dateStr,
          amount: absAmount,
          currency: "ZAR",
          direction,
          type: inferTransactionType({ direction, rawDescription: rawDesc }),
          rawDescription: rawDesc,
          cleanDescription: cleanDescription(rawDesc),
          balance: balance !== undefined && !isNaN(balance) ? balance : undefined,
          dedupeHash,
        },
      });

      totalRows++;
    };

    for (const [i, rawLine] of lines.entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      if (SKIP_PATTERNS.some((p) => p.test(line))) continue;

      const dateMatch = line.match(DATE_PATTERN);
      if (dateMatch) {
        // Flush previous pending transaction
        flushPending(pendingLineIdx);

        const dateStr = dateMatch[1];
        const dateObj = parseSaDate(dateStr);
        if (!dateObj) continue;

        if (!statementFrom || dateObj < statementFrom) statementFrom = dateObj;
        if (!statementTo || dateObj > statementTo) statementTo = dateObj;

        // Extract amounts from rest of line
        const rest = line.slice(dateMatch[0].length).trim();
        const amounts = extractAmounts(rest);
        // Description is the non-numeric part after the date
        const descPart = rest.replace(AMOUNT_PATTERN, "").trim();

        pendingDate = dateObj;
        pendingDesc = descPart;
        pendingAmounts = amounts;
        pendingLineIdx = i;
      } else if (pendingDate) {
        // Continuation line — append to description if no new amounts
        const continuationAmounts = extractAmounts(line);
        if (continuationAmounts.length === 0) {
          pendingDesc += " " + line;
        } else {
          // This line has amounts — it's a separate transaction, flush first
          flushPending(pendingLineIdx);
          pendingDate = null;
        }
      }
    }
    // Flush last pending
    flushPending(pendingLineIdx);

    return {
      source: this.source,
      institutionHint: "SA Bank",
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
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseSaAmount(raw: string): number {
  let str = raw.trim();
  const trailingMinus = str.endsWith("-");
  if (trailingMinus) str = str.slice(0, -1);
  str = str.replace(/[\s,]/g, "");
  const val = parseFloat(str);
  return trailingMinus ? -Math.abs(val) : val;
}

function extractAmounts(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_PATTERN.source, "g");
  while ((m = re.exec(text)) !== null) {
    matches.push(m[1].replace(/\s/g, ""));
  }
  return matches;
}
