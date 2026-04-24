/**
 * lib/finance/normalize.ts
 *
 * Core normalization utilities.
 *
 * normalizeParsedRow() takes a parser's raw row output and produces a
 * canonical NormalizedTransaction payload ready for DB insertion.
 *
 * This is the final normalization step after parser-specific parsing —
 * it applies merchant alias matching, description cleaning, type inference,
 * and hash computation.
 */

import type { NormalizedTransaction, TransactionType, TransactionDirection } from "@/lib/types/finance";
import { computeTransactionHash } from "./dedupe";

// ---------------------------------------------------------------------------
// Description cleaning
// ---------------------------------------------------------------------------

// Patterns to strip from raw descriptions (ordered — applied in sequence)
const STRIP_PATTERNS = [
  /\*+/g,                          // repeated asterisks
  /\s{2,}/g,                       // multiple spaces → single
  /ref[:\s]+\w+/gi,                // "Ref: ABC123"
  /\b\d{10,}\b/g,                  // long numeric reference sequences
  /card\s+\d{4}/gi,                // "Card 1234"
  /pos\s+purchase/gi,              // POS prefix
  /internet\s+banking\s+payment/gi,
  /online\s+banking/gi,
];

const MERCHANT_STRIP_PREFIXES = [
  /^purchase\s+/i,
  /^payment\s+to\s+/i,
  /^pay\s+/i,
  /^debit\s+order\s+/i,
  /^debit\s+/i,
  /^card\s+purchase\s+/i,
  /^eft\s+payment\s+/i,
];

export function cleanDescription(raw: string): string {
  let cleaned = raw.trim();
  for (const pattern of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // Title-case
  return toTitleCase(cleaned);
}

function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

export function extractMerchantName(cleanDesc: string): string {
  let merchant = cleanDesc;
  for (const prefix of MERCHANT_STRIP_PREFIXES) {
    merchant = merchant.replace(prefix, "");
  }
  // Take first meaningful segment (split on common separators)
  const segments = merchant.split(/\s{2,}|[;|]/);
  merchant = segments[0]?.trim() ?? merchant;
  return merchant.length > 0 ? merchant : cleanDesc;
}

// ---------------------------------------------------------------------------
// Transaction type inference
// ---------------------------------------------------------------------------

interface TypeInferenceInput {
  direction: TransactionDirection;
  rawDescription: string;
}

export function inferTransactionType(input: TypeInferenceInput): TransactionType {
  const desc = input.rawDescription.toLowerCase();
  const isDebit = input.direction === "DEBIT";

  if (/salary|payroll|wage|remuneration/i.test(desc)) return "INCOME";
  if (/interest\s+received|interest\s+credit/i.test(desc)) return "INCOME";
  if (/refund|reversal|cashback/i.test(desc)) return "REFUND";
  if (/transfer|tfr|trf/i.test(desc)) return "TRANSFER";
  if (/debit\s+order|debicheck|mandate/i.test(desc)) return "DEBIT_ORDER";
  if (/atm|cash\s+withdrawal|withdraw/i.test(desc)) return "CASH_WITHDRAWAL";
  if (/bank\s+charge|service\s+fee|monthly\s+fee|administration\s+fee/i.test(desc)) return "FEE";
  if (/eft|electronic\s+fund/i.test(desc)) return "EFT";
  if (/pos\s+purchase|card\s+purchase|tap\s+to\s+pay/i.test(desc)) return "CARD_PURCHASE";
  if (!isDebit) return "INCOME";
  return "EXPENSE";
}

// ---------------------------------------------------------------------------
// Master normalization function
// ---------------------------------------------------------------------------

export interface NormalizationInput {
  date: string;           // YYYY-MM-DD
  amount: number;         // positive
  currency: string;
  direction: TransactionDirection;
  rawDescription: string;
  referenceNumber?: string;
  balance?: number;
  /** Required for dedup hash — the account DB ID or hint */
  accountId: string;
}

/**
 * Takes a parser's partially-normalized row and produces the final
 * NormalizedTransaction payload ready for DB insertion.
 */
export function normalizeParsedRow(input: NormalizationInput): NormalizedTransaction {
  const cleanDesc = cleanDescription(input.rawDescription);
  const merchantName = extractMerchantName(cleanDesc);
  const type = inferTransactionType({ direction: input.direction, rawDescription: input.rawDescription });

  const dedupeHash = computeTransactionHash({
    date: input.date,
    amount: input.amount,
    direction: input.direction,
    accountId: input.accountId,
    rawDescription: input.rawDescription,
    currency: input.currency,
  });

  return {
    date: input.date,
    amount: input.amount,
    currency: input.currency,
    direction: input.direction,
    type,
    rawDescription: input.rawDescription,
    cleanDescription: cleanDesc,
    merchantName,
    referenceNumber: input.referenceNumber,
    balance: input.balance,
    dedupeHash,
  };
}
