/**
 * components/layout/topbar.tsx
 */

"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/transactions": "Transactions",
  "/imports":      "Imports",
  "/budgets":      "Budgets",
  "/investments":  "Investments",
  "/settings":     "Settings",
};

export default function Topbar() {
  const pathname = usePathname();
  const base = "/" + pathname.split("/")[1];
  const title = PAGE_TITLES[base] ?? "FinanceOS";

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 shrink-0">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
    </header>
  );
}
