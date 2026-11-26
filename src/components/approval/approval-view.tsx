"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RfqDetailsCard } from "@/components/rfq/rfq-details-card";
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

function statusLabel(stage: ReviewStage, step?: string, role?: string) {
  if (stage === "approved") return "Finally Approved";
  if (stage === "returned") return "Returned to Rep";
  if (stage === "in_review" && step === "sales_director") {
    return role === "Sales Director" ? "Under your Final Review" : "Under Sales Director Review";
  }
  if (stage === "in_review") return "Under Line Manager Review";
  return "Draft";
}

function statusTone(stage: ReviewStage) {
  if (stage === "approved") return "approved";
  if (stage === "returned") return "returned";
  if (stage === "in_review") return "review";
  return "draft";
}

function needsYou(estimate: EstimateRecord, role: string) {
  if (estimate.reviewStage !== "in_review") return false;
  if (role === "Line Manager") return estimate.workflowStep === "line_manager" || estimate.workflowStep === "created";
  if (role === "Sales Director") return estimate.workflowStep === "sales_director";
  return role === "Admin" || role === "Super Admin";
}

function historyAction(event: AuditEvent) {
  if (event.action === "estimate.created") return "created";
  if (event.action === "sheet.saved") return "Sheet updated";
  if (event.action === "sheet.submitted") return "Submitted for Line Manager review";
  if (event.action === "sheet.advanced") return "Line Manager approved; sent to Sales Director";
  if (event.action === "sheet.approved") return "Final approval; rates and rules frozen; costs saved to history";
  if (event.action === "sheet.returned") return "Returned for correction";
  return event.detail || "Updated";
}

function historyStamp(value: string) {
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

function fieldValue(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  if (!value.trim() || !Number.isFinite(amount)) return value || "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
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
  const [deciding, setDeciding] = useState<"approved" | "returned" | "submit" | null>(null);

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
    if (!selectedId) return;
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

  const selected = selectedId
    ? estimates?.find((estimate) => estimate.id === selectedId) ?? (sheet?.estimateId === selectedId ? sheet.estimate : null) ?? null
    : null;
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
  const lines = priced.lines.filter((line) => line.item.trim());
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
  const canDecide = stage === "in_review" && (
    (role === "Line Manager" && (step === "created" || step === "line_manager"))
    || (role === "Sales Director" && step === "sales_director")
    || role === "Admin"
    || role === "Super Admin"
  );
  const atDirectorStep = step === "sales_director";
  const canSendToDirector = canDecide && !atDirectorStep && role !== "Sales Director";
  const canFinalApprove = canDecide && atDirectorStep && role !== "Line Manager";
  const canSubmit = (role === "Representative" || role === "Admin" || role === "Super Admin") && (stage === "draft" || stage === "returned");
  const showRepProgress = Boolean(selected && stage === "in_review" && role === "Representative");

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
      toast.success(
        decision === "approved"
          ? (canFinalApprove ? "Estimate approved" : "Estimate sent to the next reviewer")
          : "Returned to the sales rep for correction",
        { persist: true },
      );
      setComment("");
      router.refresh();
      setEstimates(null);
      setLoadAttempt((current) => current + 1);
    } catch {
      toast.error("Unable to record this decision. Check your connection and try again.");
    } finally {
      setDeciding(null);
    }
  }

  async function submitForReview() {
    if (!selectedId || deciding) return;
    setDecisionError("");
    setDeciding("submit");
    try {
      const response = await fetch(`/api/estimates/${encodeURIComponent(selectedId)}/submit`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        const message = payload?.error ?? "Unable to submit this estimate.";
        setDecisionError(message);
        toast.error(message);
        return;
      }
      toast.success("Estimate submitted for review", { persist: true });
      router.refresh();
      setLoadAttempt((current) => current + 1);
    } catch {
      toast.error("Unable to submit this estimate. Check your connection and try again.");
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="page-stack approvals-page">
      <h1 className="text-page-title">
        {selected ? `Approval · ${selected.id}` : "Approvals"}
        {selected ? (
          <span className={`queue-status is-${statusTone(selected.reviewStage)}`}>
            {statusLabel(selected.reviewStage, selected.workflowStep, role)}
          </span>
        ) : null}
      </h1>

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
                    {" "}<button type="button" className="text-link" onClick={() => {
                      setFailed(false);
                      setEstimates(null);
                      setLoadAttempt((current) => current + 1);
                    }}>Try again</button>
                  </td>
                </tr>
              ) : estimates === null ? (
                <tr>
                  <td className="table-empty" colSpan={6}>Loading quotations…</td>
                </tr>
              ) : estimates.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={6}>No quotation yet</td>
                </tr>
              ) : (
                estimates.map((estimate) => (
                  <tr key={estimate.id} className={estimate.id === selectedId ? "is-selected" : undefined}>
                    <td className="cell-strong">{estimate.id}</td>
                    <td>
                      {estimate.clientName || "—"}
                      {estimate.clientName ? <span className="queue-by"> · by {estimate.originator || "—"}</span> : null}
                    </td>
                    <td>{estimate.title || "—"}</td>
                    <td>
                      <span className={`queue-status is-${statusTone(estimate.reviewStage)}`}>
                        {statusLabel(estimate.reviewStage, estimate.workflowStep, role)}
                      </span>
                      {needsYou(estimate, role) ? <span className="needs-you">Needs you</span> : null}
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
          <span style={{ width: activeStep < 0 ? "2%" : `${((activeStep + 1) / STEPS.length) * 100}%` }} />
        </div>
        <ol className="workflow-pills">
          {STEPS.map((label, index) => (
            <li key={label}>
              <span className={selectedId && index <= activeStep ? "workflow-pill is-current" : selectedId ? "workflow-pill is-waiting" : "workflow-pill"}>
                {label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {selected ? <RfqDetailsCard estimate={selected} /> : null}

      {selected && stage === "returned" ? (
        <p className="text-error" role="status">
          This estimate was returned. Correct the sheet, then send it for review again.
        </p>
      ) : null}

      <div className={selected ? "approval-grid" : undefined}>
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

          <div className="table-scroll">
            <table className="data-table breakdown-table">
              <thead>
                <tr>
                  {["#", "Item", "Source", "Currency", "Qty", "Base", "Freight"].map((heading) => (
                    <th key={heading} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedId && lines.length > 0 ? (
                  lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td><input className="sheet-input sheet-input-item" value={line.item} readOnly aria-label={`Item ${index + 1}`} /></td>
                      <td>
                        <select className="sheet-select" value={line.source} disabled aria-label={`Source ${index + 1}`}>
                          <option>{line.source}</option>
                        </select>
                      </td>
                      <td>
                        <select className="sheet-select" value={line.source === "Local" ? "NGN" : line.currency} disabled aria-label={`Currency ${index + 1}`}>
                          <option>{line.source === "Local" ? "NGN" : line.currency}</option>
                        </select>
                      </td>
                      <td><input className="sheet-input sheet-input-num" value={fieldValue(line.qty || "0")} readOnly aria-label={`Qty ${index + 1}`} /></td>
                      <td><input className="sheet-input sheet-input-num" value={fieldValue(line.base || "0")} readOnly aria-label={`Base ${index + 1}`} /></td>
                      <td><input className="sheet-input sheet-input-num" value={line.source === "Local" ? "0" : fieldValue(line.freight || "0")} readOnly aria-label={`Freight ${index + 1}`} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      {selectedId ? "No items on this sheet yet." : "Open an estimate to see the quote-analysis breakdown."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {selectedId && priced.itemCount > 0 ? (
            <div className="breakdown-grand">
              <span>Grand total (NGN)</span>
              <strong>{formatGrandTotal(priced.grandTotalNgn)}</strong>
            </div>
          ) : null}
        </section>

        {selected ? (
          <section className="surface-card approvals-card decision-card">
            {showRepProgress ? (
              <>
                <h2>Review progress</h2>
                <ol className="progress-list">
                  <li>
                    <span className="progress-index is-done">1</span>
                    <div>
                      <p className="progress-name is-submitted">Submitted</p>
                      <p className="progress-detail">Estimate sent for review</p>
                    </div>
                  </li>
                  <li>
                    <span className={`progress-index ${step === "sales_director" ? "is-done" : "is-current"}`}>2</span>
                    <div>
                      <p className="progress-name is-pending">Pending review</p>
                      <p className="progress-detail">
                        {step === "sales_director" ? "Awaiting Sales Director decision" : "Awaiting an approval decision"}
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className="progress-index">3</span>
                    <div>
                      <p className="progress-name is-waiting">Decision</p>
                      <p className="progress-detail">Approval or changes requested</p>
                    </div>
                  </li>
                </ol>
                <p className="progress-detail">The estimate will be locked once it is approved.</p>
                <div className="decision-stack">
                  <Link href={`/estimation?estimate=${encodeURIComponent(selected.id)}`} className="queue-action decision-btn">
                    Back to estimation sheet
                  </Link>
                  <button type="button" className="add-item-btn decision-btn" onClick={() => router.push(`/approval?estimate=${encodeURIComponent(selected.id)}`)}>
                    View submitted estimate
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Your decision</h2>
                <label className="field-label" htmlFor="decision-comment">Comment</label>
                <textarea id="decision-comment" className="field-input decision-comment" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} />
                {decisionError ? <p className="text-error" role="alert">{decisionError}</p> : null}
                <div className="decision-stack">
                  {canSubmit ? (
                    <button type="button" className="add-item-btn decision-btn" disabled={deciding !== null} onClick={() => void submitForReview()}>
                      {deciding === "submit" ? "Sending…" : "Send for review"}
                    </button>
                  ) : null}
                  {canSubmit ? (
                    <Link href={`/estimation?estimate=${encodeURIComponent(selected.id)}`} className="queue-action decision-btn">
                      Correct estimation sheet
                    </Link>
                  ) : null}
                  {canFinalApprove ? (
                    <button type="button" className="add-item-btn decision-btn" disabled={deciding !== null} onClick={() => decide("approved")}>
                      {deciding === "approved" ? "Approving…" : "Final Approval"}
                    </button>
                  ) : null}
                  {canSendToDirector ? (
                    <button type="button" className="add-item-btn decision-btn" disabled={deciding !== null} onClick={() => decide("approved")}>
                      {deciding === "approved" ? "Approving…" : "Approve (Send to Sales Director)"}
                    </button>
                  ) : null}
                  {canDecide ? (
                    <button type="button" className="queue-action decision-btn" disabled={deciding !== null} onClick={() => decide("returned")}>
                      {deciding === "returned" ? "Returning…" : "Return for Correction"}
                    </button>
                  ) : null}
                  {canDecide ? (
                    <button type="button" className="queue-action decision-btn is-reject" disabled={deciding !== null} onClick={() => decide("returned")}>
                      Reject
                    </button>
                  ) : null}
                  <button type="button" className="queue-action decision-btn" onClick={() => router.push("/approval")}>Close RFQ</button>
                  {stage === "approved" ? (
                    <Link href="/reports" className="add-item-btn decision-btn">Create & Send Quotation to Client</Link>
                  ) : null}
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>

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
                <strong>{event.actor}</strong>
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
