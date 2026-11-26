import type { Metadata } from "next";
import { Suspense } from "react";
import { QuotationTable } from "@/components/dashboard/quotation-table";
import { CreateRfqButton } from "@/components/rfq/create-rfq-button";
import { listEstimates } from "@/lib/estimates";
import { getSession } from "@/lib/session";
import type { EstimateRecord } from "@/lib/types";

export const metadata: Metadata = { title: "RFQs and tenders" };

function RfqsView({ estimates, role }: { estimates: EstimateRecord[]; role?: string }) {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">RFQs & tenders</h1>
        <CreateRfqButton />
      </div>
      <section className="surface-card panel-card" aria-label="RFQ list">
        <QuotationTable
          estimates={estimates}
          role={role}
          viewHref={(estimate) => `/estimation?estimate=${encodeURIComponent(estimate.id)}`}
        />
      </section>
    </div>
  );
}

async function RfqsSession() {
  const session = await getSession();
  if (!session) return <RfqsView estimates={[]} />;
  return <RfqsView estimates={await listEstimates(session.organizationId)} role={session.role} />;
}

export default function RfqsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-stack">
          <div className="page-heading">
            <h1 className="text-page-title">RFQs & tenders</h1>
          </div>
          <p>Loading RFQs…</p>
        </div>
      }
    >
      <RfqsSession />
    </Suspense>
  );
}
