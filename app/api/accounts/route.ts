/**
 * app/api/accounts/route.ts
 *
 * GET /api/accounts   — list accounts
 * POST /api/accounts  — create account
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

const CreateAccountSchema = z.object({
  name: z.string().min(1),
  institution: z.string().optional(),
  accountNumber: z.string().optional(),
  currency: z.string().default("ZAR"),
});

export async function GET() {
  const accounts = await db.account.findMany({
    where: { userId: SYSTEM_USER_ID },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ success: true, data: accounts });
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateAccountSchema>;
  try {
    body = CreateAccountSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }

  // Mask account number to last 4 digits for privacy
  const maskedNumber = body.accountNumber
    ? "****" + body.accountNumber.replace(/\s/g, "").slice(-4)
    : undefined;

  // Ensure default user exists
  await db.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: { id: SYSTEM_USER_ID, email: "local@financeos.app", name: "Local User" },
  });

  const account = await db.account.create({
    data: {
      userId: SYSTEM_USER_ID,
      name: body.name,
      institution: body.institution,
      accountNumber: maskedNumber,
      currency: body.currency,
    },
  });

  return NextResponse.json({ success: true, data: account }, { status: 201 });
}
