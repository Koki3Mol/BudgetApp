/**
 * lib/finance/dedupe.ts
 *
 * Deduplication utilities for import pipeline.
 *
 * Strategy:
 * - computeTransactionHash: deterministic SHA-256 key from stable transaction fields.
 *   Using date+amount+direction+accountId+rawDescription+currency provides strong
 *   deduplication while surviving description whitespace normalization.
 *
 * - detectDuplicateCandidates: compares a batch of incoming normalized transactions
 *   against (a) existing DB records and (b) within-batch duplicates.
 */

import { sha256 } from "@/lib/utils/hash";
import type { NormalizedTransaction, DuplicateCandidate } from "@/lib/types/finance";

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

export interface HashInput {
  date: string;         // YYYY-MM-DD
  amount: number;       // positive, 2dp
  direction: string;    // DEBIT | CREDIT
  accountId: string;
  rawDescription: string;
  currency: string;
}

/**
 * Produces a deterministic deduplication key.
 * Amount is rounded to 2 decimal places to avoid floating-point drift.
 * Description is lowercased and whitespace-normalized.
 */
export function computeTransactionHash(input: HashInput): string {
  const normalizedDesc = input.rawDescription.toLowerCase().replace(/\s+/g, " ").trim();
  const amountFixed = input.amount.toFixed(2);
  const key = [
    input.date,
    amountFixed,
    input.direction.toUpperCase(),
    input.accountId,
    normalizedDesc,
    input.currency.toUpperCase(),
  ].join("|");
  return sha256(key);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateDetectionInput {
  /** Incoming normalized transactions from this import batch */
  incoming: NormalizedTransaction[];
  /** Set of dedupe hashes already in the database for this account */
  existingHashes: Map<string, string>; // hash → transaction DB id
}

/**
 * Detects duplicate candidates in an import batch.
 *
 * Returns a DuplicateCandidate for each incoming transaction that:
 * - Matches an existing DB record (by exact hash)
 * - Matches another transaction within the same batch (within-batch duplicate)
 *
 * Does NOT include fuzzy matching in MVP — only exact hash matches.
 * Fuzzy matching (e.g. same date+amount, slightly different description) is a
 * Phase 2 enhancement.
 */
export function detectDuplicateCandidates(
  input: DuplicateDetectionInput
): DuplicateCandidate[] {
  const { incoming, existingHashes } = input;
  const candidates: DuplicateCandidate[] = [];

  // Track hashes seen within this batch to detect within-batch duplicates
  const batchHashIndex = new Map<string, number>(); // hash → first occurrence index

  for (let i = 0; i < incoming.length; i++) {
    const tx = incoming[i];
    const hash = tx.dedupeHash;

    // Check against DB
    if (existingHashes.has(hash)) {
      candidates.push({
        incomingIndex: i,
        existingId: existingHashes.get(hash)!,
        reason: "exact_hash",
      });
      continue; // Don't also flag as within-batch if it's already a DB dupe
    }

    // Check within batch
    if (batchHashIndex.has(hash)) {
      candidates.push({
        incomingIndex: i,
        batchIndex: batchHashIndex.get(hash)!,
        reason: "within_batch",
      });
    } else {
      batchHashIndex.set(hash, i);
    }
  }

  return candidates;
}

/**
 * Filters an incoming batch to only non-duplicate transactions.
 * Returns the transactions that should be committed to the DB.
 */
export function filterDuplicates(
  incoming: NormalizedTransaction[],
  candidates: DuplicateCandidate[]
): { toInsert: NormalizedTransaction[]; skipped: NormalizedTransaction[] } {
  const duplicateIndices = new Set(candidates.map((c) => c.incomingIndex));
  const toInsert: NormalizedTransaction[] = [];
  const skipped: NormalizedTransaction[] = [];

  for (let i = 0; i < incoming.length; i++) {
    if (duplicateIndices.has(i)) {
      skipped.push(incoming[i]);
    } else {
      toInsert.push(incoming[i]);
    }
  }

  return { toInsert, skipped };
}
