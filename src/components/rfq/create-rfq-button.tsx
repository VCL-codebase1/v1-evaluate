"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CreateRfqButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => {
        setPending(true);
        router.push("/rfqs/new");
      }}
    >
      {pending ? "Opening…" : "+ New RFQ Estimate"}
    </Button>
  );
}
