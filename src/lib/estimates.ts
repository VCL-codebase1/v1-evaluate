import { WORKFLOW_STEPS } from "@/lib/constants";
import type { DashboardSummary, EstimateRecord, EstimateStatus } from "@/lib/types";

type Store = { estimates: EstimateRecord[] };

const globalStore = globalThis as typeof globalThis & { __v11Store?: Store };

function store() {
  if (!globalStore.__v11Store) {
    globalStore.__v11Store = { estimates: [] };
  }
  return globalStore.__v11Store;
}

export function listEstimates() {
  return store().estimates;
}

export function createEstimate(input: {
  title: string;
  mode?: string;
  status?: EstimateStatus;
}) {
  const record: EstimateRecord = {
    id: `EST-2026-${String(store().estimates.length + 1).padStart(3, "0")}`,
    title: input.title.trim(),
    mode: input.mode?.trim() || "Air freight",
    status: input.status ?? "pending",
    createdAt: new Date().toISOString(),
  };
  store().estimates = [record, ...store().estimates];
  return record;
}

export function getDashboardSummary(): DashboardSummary {
  const estimates = listEstimates();
  const count = (status: EstimateStatus) =>
    estimates.filter((estimate) => estimate.status === status).length;

  return {
    steps: WORKFLOW_STEPS,
    progress: estimates.length === 0 ? 3 : 28,
    stats: [
      {
        key: "total",
        label: "Total estimates",
        value: estimates.length,
        tone: "purple",
      },
      {
        key: "pending",
        label: "Pending review",
        value: count("pending"),
        tone: "orange",
      },
      {
        key: "approved",
        label: "Approved",
        value: count("approved"),
        tone: "green",
      },
      {
        key: "rejected",
        label: "Returned / Rejected",
        value: count("rejected"),
        tone: "red",
      },
    ],
  };
}
