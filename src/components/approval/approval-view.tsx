"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RfqDetailsCard } from "@/components/rfq/rfq-details-card";
import { SheetPreview } from "@/components/estimation/sheet-preview";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";
import { DEFAULT_RATES, formatGrandTotal, summarizeSheet } from "@/lib/estimation";
import { toast } from "@/lib/toast";
import type { AuditEvent, EstimateRecord, ExchangeRateTable, ReviewStage, SheetLine } from "@/lib/types";

const STEPS = [
  "Estimate Created",
  "Approved by Line Manager",
  "Approved by Sales Director",
  "Finally Approved",
] as const;

type SheetPayload = {
  estimateId: string;
  reviewStage: ReviewStage;
  lines: SheetLine[];
  rates?: ExchangeRateTable;
  rules?: PricingRules;
  estimate?: EstimateRecord;
  summary: { grandTotalNgn: number };
};

function statusLabel(stage: ReviewStage, step?: string) {
  if (stage === "approved") return "Finally Approved";
  if (stage === "returned") return "Returned";
  if (stage === "in_review" && step === "sales_director") return "Under Sales Director Review";
  if (stage === "in_review") return "Under Line Manager Review";
  return "Draft";
}

function actorLabel(actor: string) {
  if (actor.includes("(")) return actor;
  return actor;
}

function historyAction(event: AuditEvent) {
  if (event.action === "estimate.created") return "created";
  if (event.action === "item.added") return "Item added";
  if (event.action === "sheet.saved") return "Sheet updated";
  if (event.action === "sheet.submitted") return "Submitted for Line Manager review";
  if (event.action === "sheet.advanced") return event.detail || "Approved by Line Manager";
  if (event.action === "sheet.approved") return "Finally Approved";
  if (event.action === "sheet.returned") return "Returned";
  return event.detail || "Updated";
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
  const [role, setRole] = useState("");
  const [comment, setComment] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deciding, setDeciding] = useState<"approved" | "returned" | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { user?: { role?: string } } | null) => setRole(payload?.user?.role ?? ""))
      .catch(() => setRole(""));
  }, []);

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
  }, [loadAttempt]);

  useEffect(() => {
    if (!selectedId) {
      setSheet(null);
      return;
    }
    let active = true;
    fetch(`/api/estimates/${encodeURIComponent(selectedId)}/sheet`)
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
  }, [selectedId, loadAttempt]);

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
  }, [loadAttempt]);

  const selected = estimates?.find((estimate) => estimate.id === selectedId) ?? sheet?.estimate ?? null;
  const activeSheet = selectedId && sheet?.estimateId === selectedId ? sheet : null;
  const stage = selected?.reviewStage ?? activeSheet?.reviewStage ?? null;
  const priced = useMemo(
    () => summarizeSheet(
      activeSheet?.lines ?? [],
      { ...DEFAULT_RATES, ...activeSheet?.rates },
      activeSheet?.rules ?? DEFAULT_RULES,
    ),
    [activeSheet],
  );
  const history = selectedId ? events.filter((event) => event.estimateId === selectedId) : [];
  const locked = stage === "in_review" || stage === "approved";
  const step = selected?.workflowStep ?? "created";
  const activeStep = !selectedId
    ? -1
    : stage === "approved" || step === "final"
      ? 3
      : step === "sales_director"
        ? 2
        : step === "line_manager"
          ? 1
          : 0;
  const idleSteps = role === "Line Manager"
    ? (["Estimate Created", "Approved by Sales Director", "Finally Approved"] as const)
    : role === "Sales Director"
      ? (["Estimate Created", "Approved by Line Manager", "Finally Approved"] as const)
      : STEPS;
  const visibleSteps = selectedId ? STEPS : idleSteps;
  const canDecide = stage === "in_review" && (
    (role === "Line Manager" && (step === "created" || step === "line_manager"))
    || (role === "Sales Director" && step === "sales_director")
    || role === "Admin"
    || role === "Super Admin"
  );
  const atDirectorStep = step === "sales_director";
  const canSendToDirector = canDecide && !atDirectorStep && role !== "Sales Director";
  const canFinalApprove = canDecide && atDirectorStep && role !== "Line Manager";

  async function decide(decision: "approved" | "returned") {
    if (!selectedId || deciding) return;
    setDecisionError("");
    setDeciding(decision);
    try {
      const response = await fetch(`/api/estimates/${encodeURIComponent(selectedId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error || "Unable to record this decision.";
        setDecisionError(message);
        toast.error(message);
        return;
      }
      toast.success(decision === "approved" ? (canFinalApprove ? "Estimate approved" : "Estimate sent to the next reviewer") : "Estimate returned");
      setComment("");
      router.refresh();
      setEstimates(null);
      setLoadAttempt((current) => current + 1);
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="page-stack approvals-page">
      <h1 className="text-page-title">
        {selected ? `Approval · ${selected.id}` : "Approvals"}
        {selected ? <span className="queue-status">{statusLabel(selected.reviewStage, selected.workflowStep)}</span> : null}
      </h1>

      <section className="surface-card approvals-card">
        <h2>Quotation queue</h2>
        <div className="table-scroll">
          <table className="data-table approvals-queue">
            <thead>
              <tr>
                <th scope="col">Estimate</th>
                <th scope="col">Qref</th>
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
                  <td className="table-empty" colSpan={7}>
                    The queue could not be loaded.
                    {" "}<button type="button" className="text-link" onClick={() => {
                      setFailed(false);
                      setEstimates(null);
                      setLoadAttempt((current) => current + 1);
                    }}>Try again</button>
                  </td>
                </tr>
              ) : estimates === null ? (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    Loading quotations…
                  </td>
                </tr>
              ) : estimates.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    No quotation yet
                  </td>
                </tr>
              ) : (
                estimates.map((estimate) => (
                  <tr key={estimate.id} className={estimate.id === selectedId ? "is-selected" : undefined}>
                    <td className="cell-strong">{estimate.id}</td>
                    <td>{estimate.qref || "—"}</td>
                    <td>
                      {estimate.clientName || "—"}
                      {estimate.clientName ? <span className="queue-by"> · by {estimate.originator || "—"}</span> : null}
                    </td>
                    <td>{estimate.title || "—"}</td>
                    <td>
                      <span className="queue-status">{statusLabel(estimate.reviewStage, estimate.workflowStep)}</span>
                    </td>
                    <td>{estimate.totalNgn == null ? "—" : formatGrandTotal(estimate.totalNgn)}</td>
                    <td>
                      <button
                        type="button"
                        className="queue-action"
                        onClick={() => router.push(`/approval?estimate=${encodeURIComponent(estimate.id)}`)}
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
          <span style={{ width: activeStep < 0 ? "2%" : `${((activeStep + 1) / visibleSteps.length) * 100}%` }} />
        </div>
        <ol className="workflow-pills">
          {visibleSteps.map((label, index) => (
            <li key={label}>
              <span className={selectedId && index <= activeStep ? "workflow-pill is-current" : "workflow-pill"}>{label}</span>
            </li>
          ))}
        </ol>
      </section>

      {selected ? <RfqDetailsCard estimate={selected} /> : null}

      <section className="surface-card approvals-card">
        <div className="breakdown-head">
          <div>
            <h2>Cost breakdown · how it was calculated</h2>
            <p>Can only be edited after review or can be directly edited by the reviewer</p>
          </div>
          {selectedId && !locked ? (
            <Link href={`/estimation?estimate=${encodeURIComponent(selectedId)}`} className="add-item-btn">
              <span aria-hidden>•</span> Add item
            </Link>
          ) : (
            <button type="button" className="add-item-btn" disabled>
              <span aria-hidden>•</span> Add item
            </button>
          )}
        </div>

        <SheetPreview
          lines={priced.lines}
          emptyLabel={selectedId ? "No items on this sheet yet." : "Open an estimate to see the quote-analysis breakdown."}
        />
        {selectedId && priced.itemCount > 0 ? (
          <div className="breakdown-grand">
            <span>Grand total (NGN)</span>
            <strong>{formatGrandTotal(priced.grandTotalNgn)}</strong>
          </div>
        ) : null}
      </section>

      {selected ? (
        <section className="surface-card approvals-card">
          <h2>Your decision</h2>
          <label className="field-label" htmlFor="decision-comment">Comment</label>
          <textarea id="decision-comment" className="field-input" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} />
          {decisionError ? <p className="text-error" role="alert">{decisionError}</p> : null}
          <div className="form-fields">
            {canFinalApprove ? (
              <button type="button" className="add-item-btn" disabled={deciding !== null} onClick={() => decide("approved")}>
                {deciding === "approved" ? "Approving…" : "Final Approval"}
              </button>
            ) : null}
            {canSendToDirector ? (
              <button type="button" className="add-item-btn" disabled={deciding !== null} onClick={() => decide("approved")}>
                {deciding === "approved" ? "Approving…" : "Approve (Send to Sales Director)"}
              </button>
            ) : null}
            {canDecide ? (
              <button type="button" className="queue-action" disabled={deciding !== null} onClick={() => decide("returned")}>
                {deciding === "returned" ? "Returning…" : "Return for Correction"}
              </button>
            ) : null}
            {canDecide ? (
              <button type="button" className="queue-action" disabled={deciding !== null} onClick={() => decide("returned")}>
                Reject
              </button>
            ) : null}
            <button type="button" className="queue-action" onClick={() => router.push("/approval")}>Close RFQ</button>
            {stage === "approved" ? (
              <Link href="/reports" className="add-item-btn">Create & Send Quotation to Client</Link>
            ) : null}
          </div>
        </section>
      ) : null}

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
