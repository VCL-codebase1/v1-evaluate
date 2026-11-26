"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Workspace page failed to load", error);
  }, [error]);

  return (
    <main className="page-stack" style={{ maxWidth: 560, margin: "12vh auto", padding: 24 }}>
      <h1 className="text-page-title">This page is temporarily unavailable</h1>
      <p className="text-page-copy">Your work has not been signed out. Try loading the page again.</p>
      <div>
        <button type="button" className="solid-action" onClick={() => retry()}>Try again</button>
      </div>
    </main>
  );
}
