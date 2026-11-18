import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "Audit trail" };

export default function AuditPage() {
  return (
    <ModulePage
      title="Audit trail"
      description="Every change to an estimate will be recorded here, with the person and time."
    />
  );
}
