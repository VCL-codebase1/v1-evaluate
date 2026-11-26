import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EstimationSheet } from "@/components/estimation/estimation-sheet";
import { canManageExchangeRates } from "@/lib/auth/roles";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Estimation sheet" };

export default async function EstimationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.estimateId) {
    return (
      <div className="page-stack">
        <h1 className="text-page-title">Estimation sheet</h1>
        <p>No RFQ is available yet. Create an RFQ estimate to begin.</p>
        <Link href="/rfqs/new" className="text-link">Create an RFQ estimate</Link>
      </div>
    );
  }
  const reviewer = ["Line Manager", "Sales Director", "Admin", "Super Admin"].includes(session.role);
  return <EstimationSheet estimateId={session.estimateId} version={session.version} mode={reviewer ? "reviewer" : "originator"} canEditRates={canManageExchangeRates(session.role)} />;
}
