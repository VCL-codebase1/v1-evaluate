import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { SessionTopbar } from "@/components/layout/session-topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { TopbarFallback } from "@/components/layout/topbar";
import { getSession } from "@/lib/session";

async function SidebarFromCookie() {
  const [store, session] = await Promise.all([cookies(), getSession()]);
  return <Sidebar initialCollapsed={store.get("v11_sidebar")?.value === "collapsed"} initialRole={session?.role ?? ""} />;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Suspense fallback={<Sidebar />}>
        <SidebarFromCookie />
      </Suspense>
      <div className="app-main">
        <Suspense fallback={<TopbarFallback />}>
          <SessionTopbar />
        </Suspense>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
