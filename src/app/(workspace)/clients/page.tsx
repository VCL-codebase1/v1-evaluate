import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";
import { OrgResourceList } from "@/components/dashboard/org-resource-list";

export const metadata: Metadata = { title: "Clients and suppliers" };

export default function ClientsPage() {
  return (
    <ModulePage
      title="Clients and suppliers"
      description="Clients derived from this organization's estimates."
    >
      <OrgResourceList
        href="/api/clients"
        empty="No clients yet."
        render={(row) => `${row.name} · ${row.estimates} estimate${row.estimates === 1 ? "" : "s"}`}
      />
    </ModulePage>
  );
}
