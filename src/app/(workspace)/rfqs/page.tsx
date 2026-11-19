import type { Metadata } from "next";
import { Suspense } from "react";
import { QuotationTable } from "@/components/dashboard/quotation-table";
import { ButtonLink } from "@/components/ui/button";
import { listEstimates } from "@/lib/estimates";
import { getSession } from "@/lib/session";
import type { EstimateRecord } from "@/lib/types";

export const metadata: Metadata = { title: "RFQs and tenders" };

function RfqsView({ estimates }: { estimates: EstimateRecord[] }) {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">RFQs & tenders</h1>
        <ButtonLink href="/rfqs/new" variant="primary" size="sm">
          + New RFQ Estimate
        </ButtonLink>
      </div>
      <section className="surface-card panel-card" aria-label="RFQ list">
        <QuotationTable estimates={estimates} />
      </section>
    </div>
  );
}

async function RfqsSession() {
  await getSession();
  return <RfqsView estimates={listEstimates()} />;
}

export default function RfqsPage() {
  return (
    <Suspense fallback={<RfqsView estimates={[]} />}>
      <RfqsSession />
    </Suspense>
  );
}
