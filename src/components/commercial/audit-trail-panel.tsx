"use client";

import { useEffect, useState } from "react";
import type { AuditEvent } from "@/lib/types";

function stamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function AuditTrailPanel() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/audit")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load the audit trail.");
        setEvents(payload.events ?? []);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load the audit trail."));
  }, []);

  return (
    <div className="page-stack">
      <h1 className="text-page-title">Audit trail</h1>
      <section className="surface-card approvals-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">User</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td className="table-empty" colSpan={3}>{error}</td></tr>
              ) : events === null ? (
                <tr><td className="table-empty" colSpan={3}>Loading audit…</td></tr>
              ) : events.length === 0 ? (
                <tr><td className="table-empty" colSpan={3}>No audit yet</td></tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td>{stamp(event.at)}</td>
                    <td>{event.actor}</td>
                    <td>{event.detail || event.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
