import type { Metadata } from "next";
import { Suspense } from "react";
import { NewRfqForm } from "@/components/rfq/new-rfq-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "New RFQ registration" };

async function NewRfqSession() {
  const session = await getSession();
  const originator = session?.email ?? "";
  return <NewRfqForm key={originator || "guest"} originator={originator} />;
}

export default function NewRfqPage() {
  return (
    <Suspense fallback={<NewRfqForm key="loading" originator="" />}>
      <NewRfqSession />
    </Suspense>
  );
}
