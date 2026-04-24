/**
 * app/api/transactions/[id]/route.ts
 *
 * PATCH /api/transactions/[id]
 * Updates category, notes, or tags for a transaction.
 * Setting categoryId marks categoryLocked = true to prevent future auto-categorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const UpdateSchema = z.object({
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: z.infer<typeof UpdateSchema>;
  try {
    body = UpdateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.categoryId !== undefined) {
    update.categoryId = body.categoryId;
    update.categoryLocked = true;
  }
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.tags !== undefined) update.tags = JSON.stringify(body.tags);

  try {
    const tx = await db.transaction.update({ where: { id }, data: update });
    return NextResponse.json({ success: true, data: tx });
  } catch {
    return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
  }
}
