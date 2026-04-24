/**
 * lib/finance/investments.ts
 *
 * Portfolio computation utilities.
 *
 * computePortfolioSummary():
 * - Aggregates holdings by asset type
 * - Computes current value using latest price snapshot if available
 * - Falls back to cost basis if no price data exists
 * - Computes unrealized gain/loss per holding and total portfolio
 */

import type {
  Holding,
  Asset,
  PortfolioSummary,
  AllocationSlice,
  AssetType,
} from "@/lib/types/finance";

// ---------------------------------------------------------------------------
// Chart color mapping per asset type
// ---------------------------------------------------------------------------

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  STOCK:    "#6366f1",
  CRYPTO:   "#f97316",
  ETF:      "#22c55e",
  BOND:     "#06b6d4",
  CASH:     "#94a3b8",
  PROPERTY: "#a855f7",
  OTHER:    "#d1d5db",
};

// ---------------------------------------------------------------------------
// Extended holding with asset info and price data
// ---------------------------------------------------------------------------

export interface HoldingWithPrice extends Omit<Holding, "asset"> {
  asset: Asset;
  latestPrice?: number;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Aggregates holdings into a portfolio summary.
 *
 * For each holding:
 * - currentValue = quantity * latestPrice (if available), else totalCost
 * - unrealizedGain = currentValue - totalCost
 *
 * Portfolio totals are computed by summing across all holdings.
 * Allocation percentages are by current value (not cost basis).
 */
export function computePortfolioSummary(
  holdings: HoldingWithPrice[],
  currency = "ZAR"
): PortfolioSummary {
  // Enrich each holding with current value
  const enriched = holdings.map((h) => {
    const currentValue =
      h.latestPrice !== undefined ? h.quantity * h.latestPrice : h.totalCost;
    const unrealizedGain = currentValue - h.totalCost;
    const unrealizedGainPct = h.totalCost > 0 ? (unrealizedGain / h.totalCost) * 100 : 0;

    return {
      ...h,
      currentValue,
      unrealizedGain,
      unrealizedGainPct,
    } as Holding;
  });

  const totalCost = enriched.reduce((s, h) => s + h.totalCost, 0);
  const totalValue = enriched.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
  const unrealizedGain = totalValue - totalCost;
  const unrealizedGainPct = totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;

  // Allocation by asset type (by current value)
  const allocationMap = new Map<AssetType, number>();
  for (const h of enriched) {
    const assetType = (h.asset as Asset).assetType;
    const current = allocationMap.get(assetType) ?? 0;
    allocationMap.set(assetType, current + (h.currentValue ?? h.totalCost));
  }

  const allocations: AllocationSlice[] = Array.from(allocationMap.entries())
    .map(([assetType, value]) => ({
      assetType,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: ASSET_TYPE_COLORS[assetType] ?? "#d1d5db",
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalCost,
    totalValue,
    unrealizedGain,
    unrealizedGainPct,
    currency,
    allocations,
    holdings: enriched,
  };
}

// ---------------------------------------------------------------------------
// Holding update after a new investment transaction
// ---------------------------------------------------------------------------

export interface InvestmentTxInput {
  type: "BUY" | "SELL" | "DIVIDEND" | "FEE" | "TRANSFER_IN" | "TRANSFER_OUT" | "SPLIT";
  quantity: number;
  price: number;
  fees?: number;
}

/**
 * Compute updated holding quantities and cost basis after a new transaction.
 * Uses FIFO / average cost basis (average cost method for simplicity).
 */
export function applyInvestmentTransaction(
  current: { quantity: number; totalCost: number },
  tx: InvestmentTxInput
): { quantity: number; totalCost: number; averageCost: number } {
  let { quantity, totalCost } = current;
  const fees = tx.fees ?? 0;

  switch (tx.type) {
    case "BUY":
    case "TRANSFER_IN":
      quantity += tx.quantity;
      totalCost += tx.quantity * tx.price + fees;
      break;
    case "SELL":
    case "TRANSFER_OUT": {
      const sellQty = Math.min(tx.quantity, quantity);
      // Average cost basis: reduce proportionally
      const avgCostBefore = quantity > 0 ? totalCost / quantity : 0;
      totalCost -= sellQty * avgCostBefore;
      quantity -= sellQty;
      break;
    }
    case "DIVIDEND":
      // Dividends do not affect quantity; record as income only
      break;
    case "FEE":
      // Fees increase cost basis
      totalCost += fees;
      break;
    case "SPLIT":
      // Stock split: multiply quantity, divide cost basis per unit
      quantity *= tx.price; // tx.price = split ratio for splits
      break;
  }

  const averageCost = quantity > 0 ? totalCost / quantity : 0;
  return { quantity, totalCost, averageCost };
}
