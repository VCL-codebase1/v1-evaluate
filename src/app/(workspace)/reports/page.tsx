import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";
import { OrgResourceList } from "@/components/dashboard/org-resource-list";

export const metadata: Metadata = { title: "Reports and quotation" };

export default function ReportsPage() {
  return (
    <ModulePage
      title="Reports and quotation"
      description="Approved quotations for this organization."
    >
      <OrgResourceList
        href="/api/reports"
        empty="No approved quotation yet."
        render={(row) => `${row.id} · ${row.title || "Untitled"} · ${row.clientName || "No client"}`}
      />
    </ModulePage>
  );
}
