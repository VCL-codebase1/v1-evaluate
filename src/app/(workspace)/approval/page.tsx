import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "Approval" };

export default function ApprovalPage() {
  return (
    <ModulePage
      title="Approval"
      description="Representative, line manager, and sales director decisions will be reviewed here."
    />
  );
}
