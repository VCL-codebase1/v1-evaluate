import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "Clients and suppliers" };

export default function ClientsPage() {
  return (
    <ModulePage
      title="Clients and suppliers"
      description="The companies you source from and quote for will be kept here."
    />
  );
}
