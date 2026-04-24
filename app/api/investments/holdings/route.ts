/**
 * app/api/investments/holdings/route.ts
 *
 * GET /api/investments/holdings — returns portfolio summary
 * POST /api/investments/holdings — manually add/update a holding
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { computePortfolioSummary } from "@/lib/finance/investments";

const SYSTEM_USER_ID = "default";

export async function GET() {
  const holdings = await db.holding.findMany({
    include: {
      asset: true,
    },
  });

  // Get latest price per asset
  const assetIds = holdings.map((h) => h.assetId);
  const latestPrices = await db.priceSnapshot.findMany({
    where: { assetId: { in: assetIds } },
    orderBy: { capturedAt: "desc" },
    distinct: ["assetId"],
    select: { assetId: true, price: true },
  });
  const priceMap = new Map(latestPrices.map((p) => [p.assetId, p.price]));

  const enriched = holdings.map((h) => ({
    ...h,
    asset: {
      ...h.asset,
      assetType: h.asset.assetType as never,
      currency: h.asset.currency,
    },
    latestPrice: priceMap.get(h.assetId),
  }));

  const summary = computePortfolioSummary(enriched as never);

  return NextResponse.json({ success: true, data: summary });
}

const AddHoldingSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  assetType: z.enum(["STOCK", "CRYPTO", "ETF", "BOND", "CASH", "PROPERTY", "OTHER"]),
  currency: z.string().default("ZAR"),
  exchange: z.string().optional(),
  quantity: z.number().positive(),
  averageCost: z.number().positive(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof AddHoldingSchema>;
  try {
    body = AddHoldingSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 });
  }

  // Upsert asset
  const asset = await db.asset.upsert({
    where: { userId_symbol: { userId: SYSTEM_USER_ID, symbol: body.symbol.toUpperCase() } },
    update: { name: body.name, assetType: body.assetType as never, exchange: body.exchange },
    create: {
      userId: SYSTEM_USER_ID,
      symbol: body.symbol.toUpperCase(),
      name: body.name,
      assetType: body.assetType as never,
      currency: body.currency,
      exchange: body.exchange,
    },
  });

  const holding = await db.holding.upsert({
    where: { assetId: asset.id },
    update: {
      quantity: body.quantity,
      averageCost: body.averageCost,
      totalCost: body.quantity * body.averageCost,
      lastUpdated: new Date(),
    },
    create: {
      assetId: asset.id,
      quantity: body.quantity,
      averageCost: body.averageCost,
      totalCost: body.quantity * body.averageCost,
      currency: body.currency,
    },
  });

  return NextResponse.json({ success: true, data: { asset, holding } }, { status: 201 });
}
