import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { Mascot } from "@/components/brand/mascot";
import { SessionTopbar } from "@/components/layout/session-topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { TopbarFallback } from "@/components/layout/topbar";

async function SidebarFromCookie() {
  const store = await cookies();
  return <Sidebar initialCollapsed={store.get("v11_sidebar")?.value === "collapsed"} />;
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
        <Mascot />
      </div>
    </div>
  );
}
