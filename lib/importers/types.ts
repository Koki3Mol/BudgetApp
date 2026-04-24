/**
 * lib/importers/types.ts
 *
 * Abstract contracts for the import pipeline.
 * Every parser must implement StatementParser.
 * The registry maps source types to parser instances.
 */

import type { ImportSource, ImportError, NormalizedTransaction } from "@/lib/types/finance";

// ---------------------------------------------------------------------------
// Raw row shape — whatever the parser extracts before normalization
// ---------------------------------------------------------------------------

export interface RawRow {
  /** Zero-based index within the source file */
  rowIndex: number;
  /** The raw fields as parsed from CSV/PDF — shape varies per parser */
  fields: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parser result after processing an entire file
// ---------------------------------------------------------------------------

export interface ParseResult {
  source: ImportSource;
  /** Hint at the bank/institution name */
  institutionHint?: string;
  /** Partial account number, last 4 digits, or account name */
  accountHint?: string;
  /** Statement coverage period */
  statementFrom?: Date;
  statementTo?: Date;
  /** SHA-256 of the original file bytes */
  fileHash: string;
  /** Successfully parsed rows */
  rows: ParsedRow[];
  /** Non-fatal warnings or fatal row-level errors */
  errors: ImportError[];
  /** Total rows encountered (including skipped/errored) */
  totalRows: number;
}

export interface ParsedRow {
  rawRow: RawRow;
  /** Normalized transaction if parsing succeeded */
  normalized?: NormalizedTransaction;
  /** Row-level error if normalization failed */
  error?: ImportError;
}

// ---------------------------------------------------------------------------
// Parser interface — implement this for every source type
// ---------------------------------------------------------------------------

export interface StatementParser {
  /** Human-readable name for UI display */
  readonly name: string;
  /** The source type this parser handles */
  readonly source: ImportSource;

  /**
   * Returns true if this parser can handle the given file.
   * Used for auto-detection. Receives filename + raw bytes.
   */
  canHandle(filename: string, buffer: Buffer): Promise<boolean>;

  /**
   * Parse the file buffer into a ParseResult.
   * Must not throw; errors go into ParseResult.errors.
   */
  parse(filename: string, buffer: Buffer): Promise<ParseResult>;
}

// ---------------------------------------------------------------------------
// Generic CSV mapper — used by the GENERIC_CSV parser
// The user provides a column mapping to tell the parser which columns
// map to which normalized fields.
// ---------------------------------------------------------------------------

export interface GenericCsvColumnMap {
  date: string;
  amount?: string;
  debitAmount?: string;
  creditAmount?: string;
  description: string;
  referenceNumber?: string;
  balance?: string;
  /**
   * If a single amount column is used, this tells us how to determine direction.
   * "sign"  — negative = debit, positive = credit
   * "suffix" — amount ends with "-" for debit (e.g. "123.45-")
   * "column" — a separate column contains "debit"/"credit"
   */
  directionMode?: "sign" | "suffix" | "column";
  directionColumn?: string;
  /** Date format string for date-fns parse, e.g. "dd/MM/yyyy" */
  dateFormat?: string;
}
