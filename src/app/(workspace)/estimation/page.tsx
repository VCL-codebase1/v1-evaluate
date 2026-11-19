import type { Metadata } from "next";
import { EstimationSheet } from "@/components/estimation/estimation-sheet";

export const metadata: Metadata = { title: "Estimation sheet" };

export default function EstimationPage() {
  return <EstimationSheet estimateId="EST-2026-001" version="v1" />;
}
