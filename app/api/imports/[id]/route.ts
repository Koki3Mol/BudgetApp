/**
 * app/api/imports/[id]/route.ts
 *
 * DELETE /api/imports/:id
 * Deletes a single import batch and all transactions that came from it.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const batch = await db.importBatch.findFirst({
    where: { id, userId: SYSTEM_USER_ID },
  });

  if (!batch) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // 1. Remove transaction splits that belong to transactions in this batch
  await db.transactionSplit.deleteMany({
    where: { transaction: { batchId: id } },
  });

  // 2. Remove transactions
  await db.transaction.deleteMany({
    where: { batchId: id, userId: SYSTEM_USER_ID },
  });

  // 3. Remove batch (cascades RawImportRecord + ImportError)
  await db.importBatch.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
