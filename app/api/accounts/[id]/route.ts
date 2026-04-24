/**
 * app/api/accounts/[id]/route.ts
 *
 * PATCH /api/accounts/:id  — update account
 * DELETE /api/accounts/:id — delete account
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

const UpdateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  institution: z.string().optional(),
  accountNumber: z.string().optional(),
  currency: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: z.infer<typeof UpdateAccountSchema>;
  try {
    body = UpdateAccountSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }

  const existing = await db.account.findFirst({ where: { id, userId: SYSTEM_USER_ID } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  }

  // Mask account number if provided
  const maskedNumber = body.accountNumber
    ? "****" + body.accountNumber.replace(/\s/g, "").slice(-4)
    : undefined;

  const updated = await db.account.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.institution !== undefined && { institution: body.institution }),
      ...(maskedNumber !== undefined && { accountNumber: maskedNumber }),
      ...(body.currency !== undefined && { currency: body.currency }),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await db.account.findFirst({ where: { id, userId: SYSTEM_USER_ID } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  }

  await db.account.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
