/**
 * app/(app)/layout.tsx
 *
 * Shell layout for the authenticated app: sidebar + topbar.
 * All main app routes live under (app)/ and share this layout.
 */

import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface-raised overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-screen-xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
