/**
 * components/layout/sidebar.tsx
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowDownUp,
  Upload,
  Target,
  TrendingUp,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions",  icon: ArrowDownUp },
  { href: "/imports",      label: "Imports",       icon: Upload },
  { href: "/budgets",      label: "Budgets",       icon: Target },
  { href: "/investments",  label: "Investments",   icon: TrendingUp },
  { href: "/settings",     label: "Settings",      icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-100">
        <span className="font-bold text-lg text-brand-600 tracking-tight">FinanceOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={16} className={active ? "text-brand-600" : "text-gray-400"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">Local — single user</p>
      </div>
    </aside>
  );
}
