/**
 * app/api/imports/route.ts
 *
 * GET /api/imports
 * Returns import batch history for the current user, paginated.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/lib/types/finance";

const SYSTEM_USER_ID = "default";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const skip = (page - 1) * limit;

  const [batches, total] = await Promise.all([
    db.importBatch.findMany({
      where: { userId: SYSTEM_USER_ID },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        account: { select: { name: true, institution: true } },
        _count: { select: { importErrors: true } },
      },
    }),
    db.importBatch.count({ where: { userId: SYSTEM_USER_ID } }),
  ]);

  return NextResponse.json({
    success: true,
    data: { batches, total, page, limit },
  } satisfies ApiResponse<typeof batches extends never ? never : { batches: typeof batches; total: number; page: number; limit: number }>);
}

/**
 * DELETE /api/imports
 * Wipes all import history AND all transactions for the current user.
 */
export async function DELETE() {
  // Delete in FK-safe order
  await db.transactionSplit.deleteMany({
    where: { transaction: { userId: SYSTEM_USER_ID } },
  });
  await db.transaction.deleteMany({ where: { userId: SYSTEM_USER_ID } });
  await db.importBatch.deleteMany({ where: { userId: SYSTEM_USER_ID } });

  return NextResponse.json({ success: true });
}
