/**
 * lib/utils/currency.ts
 * Formatting helpers for monetary values.
 */

export function formatCurrency(
  amount: number,
  currency = "ZAR",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

export function formatCompact(amount: number, currency = "ZAR"): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${currency === "ZAR" ? "R" : currency} ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${currency === "ZAR" ? "R" : currency} ${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount, currency);
}

export function signedAmount(amount: number, direction: "DEBIT" | "CREDIT"): number {
  return direction === "DEBIT" ? -Math.abs(amount) : Math.abs(amount);
}
