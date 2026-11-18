import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "Reports and quotation" };

export default function ReportsPage() {
  return (
    <ModulePage
      title="Reports and quotation"
      description="Quotations generated after rates are frozen will be prepared here."
    />
  );
}
