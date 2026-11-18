import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "RFQs and tenders" };

export default function RfqsPage() {
  return (
    <ModulePage
      title="RFQs and tenders"
      description="Requests and tender packs will be listed here. The detailed screen is still in design."
    />
  );
}
