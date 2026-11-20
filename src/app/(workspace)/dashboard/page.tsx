import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { WORKFLOW_STEPS } from "@/lib/constants";
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
      summary={await getDashboardSummary()}
      estimates={await listEstimates()}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <DashboardView
          role="Representative"
          summary={{
            steps: WORKFLOW_STEPS,
            progress: 3,
            stats: [
              { key: "total", label: "Total estimates", value: 0, tone: "purple" },
              { key: "pending", label: "Pending review", value: 0, tone: "orange" },
              { key: "approved", label: "Approved", value: 0, tone: "green" },
              { key: "rejected", label: "Returned / Rejected", value: 0, tone: "red" },
            ],
          }}
          estimates={[]}
        />
      }
    >
      <DashboardSession />
    </Suspense>
  );
}
