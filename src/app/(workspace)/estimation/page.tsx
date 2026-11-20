import type { Metadata } from "next";
import { EstimationEntry } from "@/components/estimation/estimation-entry";

export const metadata: Metadata = { title: "Estimation sheet" };

export default function EstimationPage() {
  return <EstimationEntry />;
}
