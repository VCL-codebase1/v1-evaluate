"use client";

import { EstimationSheet } from "@/components/estimation/estimation-sheet";

export function ManagerEstimationSheet({ estimateId }: { estimateId: string }) {
  return <EstimationSheet estimateId={estimateId} mode="reviewer" />;
}
