import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardSummary, listEstimates } from "@/lib/estimates";
import { getSession } from "@/lib/session";
import { WORKFLOW_STEPS } from "@/lib/constants";
import type { DashboardSummary, EstimateRecord } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

const EMPTY_SUMMARY: DashboardSummary = {
  steps: WORKFLOW_STEPS,
  progress: 3,
  stats: [
    { key: "total", label: "Total estimates", value: 0, tone: "purple" },
    { key: "pending", label: "Pending review", value: 0, tone: "orange" },
    { key: "approved", label: "Approved", value: 0, tone: "green" },
    { key: "rejected", label: "Returned / Rejected", value: 0, tone: "red" },
  ],
};

const EMPTY_ESTIMATES: EstimateRecord[] = [];

async function DashboardSession() {
  const session = await getSession();
  const [summary, estimates] = await Promise.all([getDashboardSummary(), listEstimates()]);
  return <DashboardView role={session?.role ?? "Representative"} summary={summary} estimates={estimates} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardView role="Representative" summary={EMPTY_SUMMARY} estimates={EMPTY_ESTIMATES} />}>
      <DashboardSession />
    </Suspense>
  );
}
