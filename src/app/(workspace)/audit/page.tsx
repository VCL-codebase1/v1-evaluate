import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";
import { OrgResourceList } from "@/components/dashboard/org-resource-list";

export const metadata: Metadata = { title: "Audit trail" };

export default function AuditPage() {
  return (
    <ModulePage
      title="Audit trail"
      description="Changes recorded for this organization."
    >
      <OrgResourceList
        href="/api/audit"
        empty="No history yet."
        render={(row) => `${row.actor} · ${row.estimateId} · ${row.detail || row.action}`}
      />
    </ModulePage>
  );
}
