import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="auth-panel">
      <div className="auth-form">
        <h1 className="text-welcome">You are offline</h1>
        <p className="text-subtitle">Reconnect to open estimates, RFQs, and approvals. Cached screens may still be available.</p>
        <ButtonLink href="/" variant="primary" size="xl">
          Try again
        </ButtonLink>
      </div>
    </main>
  );
}
