import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardSummary, listEstimates } from "@/lib/estimates";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function DashboardSession() {
  const session = await getSession();
  return (
    <DashboardView
      role={session?.role ?? "Representative"}
      summary={getDashboardSummary()}
      estimates={listEstimates()}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <DashboardView
          role="Representative"
          summary={getDashboardSummary()}
          estimates={listEstimates()}
        />
      }
    >
      <DashboardSession />
    </Suspense>
  );
}
