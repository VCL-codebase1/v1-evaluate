import type { Metadata } from "next";
import { Suspense } from "react";
import { NewRfqForm } from "@/components/rfq/new-rfq-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "New RFQ registration" };

async function NewRfqSession() {
  const session = await getSession();
  return <NewRfqForm originator={session?.email ?? ""} />;
}

export default function NewRfqPage() {
  return (
    <Suspense fallback={<NewRfqForm originator="" />}>
      <NewRfqSession />
    </Suspense>
  );
}
