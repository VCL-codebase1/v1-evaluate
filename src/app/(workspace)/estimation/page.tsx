import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EstimationSheet } from "@/components/estimation/estimation-sheet";
import { canManageExchangeRates, canSubmitEstimate } from "@/lib/auth/roles";
import { getEstimate } from "@/lib/estimates";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Estimation sheet" };

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

async function EstimationSession({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const estimateId = firstQueryValue(params.estimate).trim();
  if (!estimateId) {
    return (
      <div className="page-stack">
        <h1 className="text-page-title">Estimation sheet</h1>
        <p>Open an RFQ from the RFQ list, or create a new estimate to begin.</p>
        <Link href="/rfqs/new" className="text-link">Create an RFQ estimate</Link>
      </div>
    );
  }

  const estimate = await getEstimate(estimateId, session.organizationId);
  if (!estimate) {
    return (
      <div className="page-stack">
        <h1 className="text-page-title">Estimation sheet</h1>
        <p>That RFQ could not be found.</p>
        <Link href="/rfqs" className="text-link">Back to RFQs</Link>
      </div>
    );
  }

  const originator = canSubmitEstimate(session.role);
  return (
    <EstimationSheet
      estimateId={estimate.id}
      version={estimate.version || session.version}
      mode={originator ? "originator" : "reviewer"}
      canEditRates={canManageExchangeRates(session.role)}
    />
  );
}

export default function EstimationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-page-title">Loading estimation sheet…</p>}>
      <EstimationSession searchParams={searchParams} />
    </Suspense>
  );
}
