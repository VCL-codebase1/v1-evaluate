"use client";

import { useEffect, useState } from "react";

export function OrgResourceList({
  href,
  empty,
  render,
}: {
  href: string;
  empty: string;
  render: (row: Record<string, unknown>) => string;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(href)
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; reports?: unknown; clients?: unknown; events?: unknown };
        if (!response.ok) throw new Error(payload.error || "Unable to load this list.");
        const list = payload.reports ?? payload.clients ?? payload.events;
        if (!active) return;
        setRows(Array.isArray(list) ? (list as Record<string, unknown>[]) : []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load this list.");
      });
    return () => {
      active = false;
    };
  }, [href]);

  if (error) return <p className="text-page-copy">{error}</p>;
  if (!rows) return <p className="text-page-copy">Loading…</p>;
  if (rows.length === 0) return <p className="text-page-copy">{empty}</p>;

  return (
    <ul className="notice-list">
      {rows.map((row, index) => (
        <li key={String(row.id ?? row.estimateId ?? index)}>{render(row)}</li>
      ))}
    </ul>
  );
}
