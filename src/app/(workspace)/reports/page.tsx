import type { Metadata } from "next";
import { ReportsPanel } from "@/components/commercial/reports-panel";

export const metadata: Metadata = { title: "Reports and quotations" };

export default function ReportsPage() {
  return <ReportsPanel />;
}
