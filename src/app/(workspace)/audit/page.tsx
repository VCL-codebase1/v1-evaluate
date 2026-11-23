import type { Metadata } from "next";
import { AuditTrailPanel } from "@/components/commercial/audit-trail-panel";

export const metadata: Metadata = { title: "Audit trail" };

export default function AuditPage() {
  return <AuditTrailPanel />;
}