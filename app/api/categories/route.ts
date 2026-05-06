/**
 * app/api/categories/route.ts
 *
 * GET /api/categories — list all categories for the current user
 * POST /api/categories — create a new category
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SYSTEM_USER_ID = "default";

export async function GET() {
  const categories = await db.category.findMany({
    where: { userId: SYSTEM_USER_ID },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, icon: true, isSystem: true },
  });
  return NextResponse.json({ success: true, data: categories });
}

export async function POST(req: NextRequest) {
  try {
    // Parse body safely — if invalid JSON, return 400 with JSON body
    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      console.error("categories POST: invalid JSON body", err);
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    // Reject duplicates
    const existing = await db.category.findFirst({
      where: { userId: SYSTEM_USER_ID, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "A category with that name already exists" }, { status: 409 });
    }

    const category = await db.category.create({
      data: {
        userId: SYSTEM_USER_ID,
        name,
        color: body.color ?? "#6366f1",
        icon: body.icon ?? null,
        isSystem: false,
      },
      select: { id: true, name: true, color: true, icon: true, isSystem: true },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (err) {
    // Ensure we always return JSON on error so the client doesn't attempt to parse an empty/non-JSON response
    console.error("categories POST error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
