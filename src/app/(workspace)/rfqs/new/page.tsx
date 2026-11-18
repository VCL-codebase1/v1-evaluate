import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "New RFQ estimate" };

export default function NewRfqPage() {
  return (
    <ModulePage
      title="New RFQ estimate"
      description="The estimate form is next. This route is ready for the sourcing, freight, markup, and approval fields."
    />
  );
}
