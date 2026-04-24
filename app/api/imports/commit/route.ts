/**
 * app/api/imports/commit/route.ts
 *
 * POST /api/imports/commit
 *
 * Commits a previewed import batch to the database.
 * Creates: ImportBatch, RawImportRecords, Transactions (with auto-categorization).
 *
 * Input: { preview: ImportPreview, accountId: string, skipDuplicates: boolean }
 * Output: { batchId, importedCount, skippedCount }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { categorizeTransaction } from "@/lib/finance/categorize";
import { filterDuplicates } from "@/lib/finance/dedupe";
import type { ApiResponse } from "@/lib/types/finance";

const SYSTEM_USER_ID = "default";

const CommitSchema = z.object({
  fileHash: z.string(),
  filename: z.string(),
  source: z.string(),
  accountId: z.string(),
  skipDuplicates: z.boolean().default(true),
  statementFrom: z.string().optional(),
  statementTo: z.string().optional(),
  transactions: z.array(
    z.object({
      date: z.string(),
      amount: z.number(),
      currency: z.string(),
      direction: z.enum(["DEBIT", "CREDIT"]),
      type: z.string(),
      rawDescription: z.string(),
      cleanDescription: z.string(),
      merchantName: z.string().optional(),
      referenceNumber: z.string().optional(),
      balance: z.number().optional(),
      dedupeHash: z.string(),
    })
  ),
  duplicateIndices: z.array(z.number()).default([]),
});

type CommitInput = z.infer<typeof CommitSchema>;

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ batchId: string; importedCount: number; skippedCount: number }>>> {
  let body: CommitInput;
  try {
    const raw = await req.json();
    body = CommitSchema.parse(raw);
  } catch (err) {
    return NextResponse.json({ success: false, error: `Invalid request: ${String(err)}` }, { status: 400 });
  }

  // Ensure user + account exist
  const account = await db.account.findFirst({ where: { id: body.accountId } });
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  }

  // Load categorization context
  const [rules, aliases, categories] = await Promise.all([
    db.categoryRule.findMany({ include: { category: true }, orderBy: { priority: "desc" } }),
    db.merchantAlias.findMany(),
    db.category.findMany({ where: { userId: SYSTEM_USER_ID } }),
  ]);

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), { id: c.id, name: c.name }]));
  const uncategorizedId = categories.find((c) => c.name === "Uncategorized")?.id ?? categories[0]?.id;

  // Load previously manually-set categories keyed by cleanDescription and merchantName.
  // This is the "category memory" — if a user manually categorized "WOOLWORTHS" as Groceries
  // before, all future imports of the same merchant will inherit that category.
  const manuallySetTxs = await db.transaction.findMany({
    where: { userId: SYSTEM_USER_ID, categoryLocked: true, categoryId: { not: null } },
    select: { cleanDescription: true, merchantName: true, categoryId: true },
  });
  // Build lookup maps: exact match → categoryId
  const memoryByMerchant = new Map<string, string>();
  const memoryByDesc = new Map<string, string>();
  for (const t of manuallySetTxs) {
    if (t.merchantName && t.categoryId) memoryByMerchant.set(t.merchantName.toLowerCase(), t.categoryId);
    if (t.categoryId) memoryByDesc.set(t.cleanDescription.toLowerCase(), t.categoryId);
  }

  // Load existing hashes for this account
  const existingTxs = await db.transaction.findMany({
    where: { accountId: body.accountId },
    select: { dedupeHash: true, id: true },
  });
  const existingHashMap = new Map(existingTxs.map((t) => [t.dedupeHash, t.id]));

  // Build duplicate candidate set
  const duplicateSet = new Set(body.duplicateIndices);

  // Create batch record
  const batch = await db.importBatch.create({
    data: {
      userId: SYSTEM_USER_ID,
      accountId: body.accountId,
      source: body.source as never,
      status: "PROCESSING",
      originalFilename: body.filename,
      fileHash: body.fileHash,
      parsedCount: body.transactions.length,
      statementFrom: body.statementFrom ? new Date(body.statementFrom) : undefined,
      statementTo: body.statementTo ? new Date(body.statementTo) : undefined,
    },
  });

  let importedCount = 0;
  let skippedCount = 0;

  // Insert transactions in a transaction (atomic)
  await db.$transaction(async (tx) => {
    for (const [idx, normalized] of body.transactions.entries()) {
      const isPreviewDuplicate = duplicateSet.has(idx);
      const isDbDuplicate = existingHashMap.has(normalized.dedupeHash);

      if ((isPreviewDuplicate || isDbDuplicate) && body.skipDuplicates) {
        // Create raw record as skipped
        await tx.rawImportRecord.create({
          data: {
            batchId: batch.id,
            rowIndex: idx,
            rawData: JSON.stringify(normalized),
            wasSkipped: true,
            skipReason: isDbDuplicate ? "EXISTING_DUPLICATE" : "BATCH_DUPLICATE",
          },
        });
        skippedCount++;
        continue;
      }

      // Auto-categorize: category memory takes precedence over keyword rules
      let resolvedCategoryId: string | undefined;
      let categoryLocked = false;

      // 1. Check memory — merchant name match (most specific)
      if (normalized.merchantName) {
        resolvedCategoryId = memoryByMerchant.get(normalized.merchantName.toLowerCase());
      }
      // 2. Check memory — clean description match
      if (!resolvedCategoryId) {
        resolvedCategoryId = memoryByDesc.get(normalized.cleanDescription.toLowerCase());
      }
      // 3. Fall back to keyword/alias rules
      if (!resolvedCategoryId) {
        const catResult = categorizeTransaction({
          cleanDescription: normalized.cleanDescription,
          merchantName: normalized.merchantName,
          transactionType: normalized.type,
          rules: rules.map((r) => ({
            id: r.id,
            categoryId: r.categoryId,
            pattern: r.pattern,
            isRegex: r.isRegex,
            priority: r.priority,
          })),
          aliases: aliases.map((a) => ({
            rawPattern: a.rawPattern,
            cleanName: a.cleanName,
            categoryHint: a.categoryHint,
            isRegex: a.isRegex,
          })),
          categoryByName,
          uncategorizedId,
        });
        resolvedCategoryId = catResult.categoryId;
      } else {
        // Matched from memory — treat as a remembered (locked) assignment
        categoryLocked = true;
      }

      // Create transaction
      const newTx = await tx.transaction.create({
        data: {
          userId: SYSTEM_USER_ID,
          accountId: body.accountId,
          batchId: batch.id,
          date: new Date(normalized.date),
          amount: normalized.amount,
          currency: normalized.currency,
          direction: normalized.direction as never,
          type: normalized.type as never,
          rawDescription: normalized.rawDescription,
          cleanDescription: normalized.cleanDescription,
          merchantName: normalized.merchantName,
          referenceNumber: normalized.referenceNumber,
          balance: normalized.balance,
          categoryId: resolvedCategoryId,
          categoryLocked,
          dedupeHash: normalized.dedupeHash,
          isDuplicate: isDbDuplicate,
        },
      });

      // Link raw record
      await tx.rawImportRecord.create({
        data: {
          batchId: batch.id,
          rowIndex: idx,
          rawData: JSON.stringify(normalized),
          transactionId: newTx.id,
        },
      });

      importedCount++;
    }

    // Update batch status
    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        importedCount,
        skippedCount,
        completedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ success: true, data: { batchId: batch.id, importedCount, skippedCount } });
}
