import type { Metadata } from "next";
import { ApprovalPanel } from "@/components/approval/approval-view";

export const metadata: Metadata = { title: "Approval" };

export default function ApprovalPage() {
  return <ApprovalPanel />;
}
