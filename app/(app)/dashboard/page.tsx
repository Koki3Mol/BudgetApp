/**
 * app/(app)/dashboard/page.tsx
 * Deprecated: Redirects to Tracking Expenses
 */

import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/tracking-expenses");
}
