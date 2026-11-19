import type { Metadata } from "next";
import { Suspense } from "react";
import { ApprovalPanel } from "@/components/approval/approval-view";

export const metadata: Metadata = { title: "Approvals" };

export default function ApprovalPage() {
  return (
    <Suspense fallback={<h1 className="text-page-title">Approvals</h1>}>
      <ApprovalPanel />
    </Suspense>
  );
}
