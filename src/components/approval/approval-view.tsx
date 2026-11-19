"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatAmount, formatGrandTotal } from "@/lib/estimation";
import type { AuditEvent, EstimateRecord, ReviewStage, SheetLine } from "@/lib/types";

const STEPS = [
  "Estimate Created",
  "Approved by Line Manager",
  "Approved by Sales Director",
  "Finally Approved",
] as const;

type ComputedLine = SheetLine & {
  bank: number;
  duties: number | null;
  agency: number | null;
  totalNgn: number;
};

type SheetPayload = {
  estimateId: string;
  reviewStage: ReviewStage;
  lines: ComputedLine[];
  summary: { grandTotalNgn: number; lines: ComputedLine[] };
};

function stageIndex(stage: ReviewStage | null) {
  if (stage === "approved") return 3;
  if (stage === "in_review" || stage === "draft" || stage === "returned") return 0;
  return -1;
}

function statusLabel(stage: ReviewStage) {
  if (stage === "approved") return "Finally Approved";
  if (stage === "returned") return "Returned";
  if (stage === "in_review") return "Under Line Manager Review";
  return "Estimate Created";
}

function actorLabel(actor: string) {
  if (actor.includes("(")) return actor;
  if (actor === "Representative") return "Rep 1 (Representative)";
  return `${actor} (Representative)`;
}

function historyAction(event: AuditEvent) {
  if (event.action === "estimate.created") return "created";
  if (event.action === "item.added") return "Item added";
  if (event.action === "sheet.saved") return "Sheet updated";
  if (event.action === "sheet.submitted") return "Submitted for Line Manager review";
  if (event.action === "sheet.approved") return "Finally Approved";
  if (event.action === "sheet.returned") return "Returned";
  return event.detail || "Updated";
}

function fieldValue(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  if (!value.trim() || !Number.isFinite(amount)) return value || "0";
  if (Number.isInteger(amount) && Math.abs(amount) >= 100000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
  }
  return value;
}

function historyStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return day.replace(",", ",");
}

export function ApprovalPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("estimate");
  const [estimates, setEstimates] = useState<EstimateRecord[] | null>(null);
  const [sheet, setSheet] = useState<SheetPayload | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/estimates")
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data: { estimates: EstimateRecord[] }) => {
        if (active) setEstimates(data.estimates);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSheet(null);
      return;
    }
    let active = true;
    fetch(`/api/estimates/${selectedId}/sheet`)
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data: SheetPayload) => {
        if (active) setSheet(data);
      })
      .catch(() => {
        if (active) setSheet(null);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    fetch("/api/audit")
      .then((response) => (response.ok ? response.json() : { events: [] }))
      .then((data: { events: AuditEvent[] }) => {
        if (active) setEvents(data.events ?? []);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [selectedId, estimates]);

  const selected = estimates?.find((estimate) => estimate.id === selectedId) ?? null;
  const stage = selected?.reviewStage ?? sheet?.reviewStage ?? null;
  const activeStep = stageIndex(selectedId ? stage : null);
  const lines = (sheet?.summary?.lines ?? sheet?.lines ?? []).filter((line) => line.item.trim());
  const history = selectedId ? events.filter((event) => event.estimateId === selectedId) : [];
  const locked = stage === "in_review" || stage === "approved";

  return (
    <div className="page-stack approvals-page">
      <h1 className="text-page-title">Approvals</h1>

      <section className="surface-card approvals-card">
        <h2>Quotation queue</h2>
        <div className="table-scroll">
          <table className="data-table approvals-queue">
            <thead>
              <tr>
                <th scope="col">Estimate</th>
                <th scope="col">Client</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Total (NGN)</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {failed ? (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    The queue could not be loaded.
                  </td>
                </tr>
              ) : estimates === null ? (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    Loading quotations…
                  </td>
                </tr>
              ) : estimates.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    No quotation yet
                  </td>
                </tr>
              ) : (
                estimates.map((estimate) => (
                  <tr key={estimate.id} className={estimate.id === selectedId ? "is-selected" : undefined}>
                    <td className="cell-strong">{estimate.id}</td>
                    <td>
                      {estimate.clientName || "—"}
                      {estimate.clientName ? <span className="queue-by"> · by {estimate.originator || "Rep 1"}</span> : null}
                    </td>
                    <td>{estimate.title || "—"}</td>
                    <td>
                      <span className="queue-status">{statusLabel(estimate.reviewStage)}</span>
                    </td>
                    <td>{estimate.totalNgn == null ? "—" : formatGrandTotal(estimate.totalNgn)}</td>
                    <td>
                      <button
                        type="button"
                        className="queue-view"
                        onClick={() => router.push(`/approval?estimate=${estimate.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card approvals-card">
        <h2>Estimate workflow · all roles</h2>
        <div className="workflow-track" aria-hidden>
          <span style={{ width: activeStep < 0 ? "2%" : `${((activeStep + 1) / STEPS.length) * 100}%` }} />
        </div>
        <ol className="workflow-pills">
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className={index === activeStep ? "workflow-pill is-current" : "workflow-pill"}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface-card approvals-card">
        <div className="breakdown-head">
          <div>
            <h2>Cost breakdown · how it was calculated</h2>
            <p>Can only be edited after review or can be directly edited by the reviewer</p>
          </div>
          {locked ? (
            <button type="button" className="add-item-btn" disabled>
              <span aria-hidden>•</span> Add item
            </button>
          ) : (
            <Link href="/estimation" className="add-item-btn">
              <span aria-hidden>•</span> Add item
            </Link>
          )}
        </div>

        {selectedId && lines.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="data-table breakdown-table">
                <thead>
                  <tr>
                    {["#", "Item", "Source", "Currency", "Qty", "Base", "Freight", "Msc", "Bank", "Duties", "Agency"].map(
                      (heading) => (
                        <th key={heading} scope="col">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>
                        <input className="sheet-input sheet-input-item" value={line.item} readOnly aria-label={`Item ${index + 1}`} />
                      </td>
                      <td>
                        <select className="sheet-select" value={line.source} disabled aria-label={`Source ${index + 1}`}>
                          <option>{line.source}</option>
                        </select>
                      </td>
                      <td>
                        <select className="sheet-select" value={line.currency} disabled aria-label={`Currency ${index + 1}`}>
                          <option>{line.currency}</option>
                        </select>
                      </td>
                      {(["qty", "base", "freight", "msc"] as const).map((field) => (
                        <td key={field}>
                          <input
                            className="sheet-input sheet-input-num"
                            value={fieldValue(line[field] || "0")}
                            readOnly
                            aria-label={`${field} ${index + 1}`}
                          />
                        </td>
                      ))}
                      <td className="breakdown-calc">{formatAmount(line.bank)}</td>
                      <td className="breakdown-calc">{formatAmount(line.duties)}</td>
                      <td className="breakdown-calc">{formatAmount(line.agency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="breakdown-rules">
              Rules used: bank 0.25% of base · customs duties 10.5% of (base + freight) · agency 7.5% of base · delivery
              1.5% of base · markup 30% of (base + freight). Sea freight adds warehouse 12.5% of base plus USD 650 SONCAP
              split across sea items. Foreign totals are multiplied by the exchange rate.
            </p>
            <div className="breakdown-grand">
              <span>Grand total (NGN)</span>
              <strong>{formatGrandTotal(sheet?.summary?.grandTotalNgn ?? selected?.totalNgn ?? 0)}</strong>
            </div>
          </>
        ) : (
          <div className="table-scroll">
            <table className="data-table approvals-queue">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Total</th>
                  <th scope="col">Total (NGN)</th>
                  <th scope="col">Extended (NGN)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table-empty" colSpan={4}>
                    No quotation yet
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card approvals-card">
        <h2 className="history-title">History</h2>
        {history.length === 0 ? (
          <p className="history-empty">No history yet</p>
        ) : (
          <ul className="history-list">
            {history.map((event) => (
              <li key={event.id}>
                <span>{historyStamp(event.at)}</span>
                <span aria-hidden> · </span>
                <strong>{actorLabel(event.actor)}</strong>
                <span aria-hidden> · </span>
                <strong>{event.estimateId}</strong>
                <span aria-hidden> · </span>
                <span>{historyAction(event)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
