"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatGrandTotal } from "@/lib/estimation";
import type { QuotationDraft } from "@/lib/commercial-types";
import type { EstimateRecord, SheetLine } from "@/lib/types";

type Tab = "reports" | "quotations";

function money(value: number) {
  return `₦${formatGrandTotal(value)}`;
}

function download(name: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportsPanel() {
  const [tab, setTab] = useState<Tab>("reports");
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [lines, setLines] = useState<(SheetLine & { unitNgn?: number; extendedNgn?: number })[]>([]);
  const [draft, setDraft] = useState<QuotationDraft | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/estimates")
      .then((response) => (response.ok ? response.json() : { estimates: [] }))
      .then((payload: { estimates?: EstimateRecord[] }) => {
        const next = payload.estimates ?? [];
        setEstimates(next);
        const approved = next.find((estimate) => estimate.reviewStage === "approved");
        setSelectedId(approved?.id || next[0]?.id || "");
      })
      .catch(() => setEstimates([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    Promise.all([
      fetch(`/api/estimates/${selectedId}/sheet`).then((response) => response.json()),
      fetch(`/api/quotations/${selectedId}`).then((response) => response.json()),
    ]).then(([sheet, quotation]) => {
      if (!active) return;
      setLines(sheet.summary?.lines ?? sheet.lines ?? []);
      setDraft(quotation.quotation ?? null);
    }).catch(() => {
      if (active) setError("Unable to load this quotation.");
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = estimates.find((estimate) => estimate.id === selectedId) ?? null;
  const priced = useMemo(() => {
    return lines.filter((line) => line.item.trim()).map((line) => {
      const qty = Number(line.qty) || 0;
      const unit = line.unitNgn ?? (Number(line.base) || 0);
      const total = line.extendedNgn ?? unit * (qty || 1);
      return { item: line.item, qty, unit, total };
    });
  }, [lines]);
  const subtotal = priced.reduce((sum, line) => sum + line.total, 0);
  const total = subtotal;

  function patch<K extends keyof QuotationDraft>(key: K, value: QuotationDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function send() {
    if (!draft || !selected) return;
    const copy = `${selected.id} Rev 00 · issued ${new Date().toLocaleDateString("en-GB")} to ${draft.recipient || "client"} · ${money(total)} · ${draft.scope} | ${draft.delivery} | ${draft.payment} | valid ${draft.validity}`;
    const next = { ...draft, issued: [copy, ...draft.issued] };
    const response = await fetch(`/api/quotations/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Unable to send this quotation.");
      return;
    }
    setDraft(payload.quotation);
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">Reports and quotations</h1>
        <button type="button" className="ghost-action" onClick={() => setTab("reports")}>Internal cost report</button>
      </div>
      <div className="segmented">
        <button type="button" className={tab === "reports" ? "is-selected" : ""} onClick={() => setTab("reports")}>Reports</button>
        <button type="button" className={tab === "quotations" ? "is-selected" : ""} onClick={() => setTab("quotations")}>Quotations</button>
      </div>

      {tab === "reports" ? (
        <>
          <section className="surface-card panel-card">
            <h2>Internal cost evaluation report</h2>
            <table className="data-table">
              <thead>
                <tr>
                  {["#", "Estimate", "Client", "Title", "Status", "Total (NGN)"].map((heading) => (
                    <th key={heading} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimates.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dashed-empty">
                        <strong>No line items yet</strong>
                        <span>Add your first record above, or import several at once.</span>
                      </div>
                    </td>
                  </tr>
                ) : estimates.map((estimate, index) => (
                  <tr key={estimate.id}>
                    <td>{index + 1}</td>
                    <td>{estimate.id}</td>
                    <td>{estimate.clientName}</td>
                    <td>{estimate.title}</td>
                    <td>{estimate.reviewStage}</td>
                    <td>{estimate.totalNgn == null ? "—" : formatGrandTotal(estimate.totalNgn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="report-actions">
              <button type="button" className="solid-action" onClick={() => window.print()}>Export PDF</button>
              <button
                type="button"
                className="ghost-action"
                onClick={() => download("internal-cost-report.csv", [
                  ["Estimate", "Client", "Title", "Status", "Total (NGN)"],
                  ...estimates.map((estimate) => [estimate.id, estimate.clientName, estimate.title, estimate.reviewStage, String(estimate.totalNgn ?? "")]),
                ])}
              >
                Export Excel
              </button>
              <button type="button" className="ghost-action" onClick={() => window.print()}>Print</button>
            </div>
          </section>
          <section className="surface-card panel-card">
            <h2>Report library</h2>
            <div className="library-grid">
              <button type="button" onClick={() => download("rfq-register.csv", [["Estimate", "Client", "Title"], ...estimates.map((estimate) => [estimate.id, estimate.clientName, estimate.title])])}>
                <strong>RFQ Register</strong>
                <span>All registered RFQs</span>
              </button>
              <button type="button" onClick={() => download("approval-report.csv", [["Estimate", "Status", "Originator"], ...estimates.map((estimate) => [estimate.id, estimate.reviewStage, estimate.originator])])}>
                <strong>Approval report</strong>
                <span>Approval activity and delays</span>
              </button>
              <button type="button" onClick={() => download("quotation-register.csv", [["Estimate", "Client", "Total"], ...estimates.filter((estimate) => estimate.reviewStage === "approved").map((estimate) => [estimate.id, estimate.clientName, String(estimate.totalNgn ?? "")])])}>
                <strong>Quotation Register</strong>
                <span>Issued and pending quotations</span>
              </button>
            </div>
            <p className="text-subtitle">Click on any library to download</p>
          </section>
        </>
      ) : !selected || !draft ? (
        <section className="surface-card panel-card">
          <div className="dashed-empty">
            <strong>No estimate selected</strong>
            <span>Start by registering an RFQ, or open a quotation from your queue</span>
          </div>
          {error ? <p className="text-error">{error}</p> : null}
          <Link href="/rfqs/new" className="solid-action">Register a RFQ</Link>
        </section>
      ) : (
        <>
          <section className="surface-card panel-card">
            <h2>Quotation {selected.id}</h2>
            <p className="text-subtitle">Terms lock when the quotation goes for approval. Issued copies are kept unchanged.</p>
            <div className="quote-fields">
              <label>Scope of work<input value={draft.scope} onChange={(event) => patch("scope", event.target.value)} /></label>
              <label>Delivery timeline<input value={draft.delivery} onChange={(event) => patch("delivery", event.target.value)} /></label>
              <label>Payment terms<input value={draft.payment} onChange={(event) => patch("payment", event.target.value)} /></label>
              <label>Validity (days)<input value={draft.validity} onChange={(event) => patch("validity", event.target.value)} /></label>
              <label>Exclusions and assumptions<input value={draft.exclusions} onChange={(event) => patch("exclusions", event.target.value)} /></label>
              <label>Warranty<input value={draft.warranty} onChange={(event) => patch("warranty", event.target.value)} /></label>
              <label>Terms and conditions<input value={draft.terms} onChange={(event) => patch("terms", event.target.value)} /></label>
              <label>Recipient (email)<input type="email" value={draft.recipient} onChange={(event) => patch("recipient", event.target.value)} /></label>
            </div>
          </section>
          <section className="surface-card panel-card quote-preview">
            <header>
              <strong>[Company logo] · Sample Company Ltd</strong>
              <span>{selected.id}</span>
            </header>
            <p>Customer: {selected.clientName || "Client"} · Project: {selected.title || "Estimate"} · Estimate ref: {selected.id}</p>
            <p>Scope: {draft.scope || "—"}</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Item</th><th>Qty</th><th>Unit price (NGN)</th><th>Total (NGN)</th>
                </tr>
              </thead>
              <tbody>
                {priced.map((line, index) => (
                  <tr key={`${line.item}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{line.item}</td>
                    <td>{line.qty || 1}</td>
                    <td>{formatGrandTotal(line.unit)}</td>
                    <td>{formatGrandTotal(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="quote-total"><span>Sub total (NGN)</span><strong>{money(subtotal)}</strong></p>
            <p className="quote-total is-grand"><span>Grand total (NGN)</span><strong>{money(total)}</strong></p>
            <p className="text-subtitle">Exclusions: {draft.exclusions || "—"} · Warranty: {draft.warranty || "—"}<br />Terms: {draft.terms || "—"}<br />Thank you for the opportunity.</p>
            <button type="button" className="solid-action" onClick={() => void send()}>Send Quotation</button>
          </section>
          <section className="surface-card panel-card">
            <h2>Issued copies (kept unchanged)</h2>
            {draft.issued.length === 0 ? <p className="text-subtitle">No quotation has been sent yet.</p> : draft.issued.map((copy) => (
              <p key={copy} className="text-subtitle">{copy}</p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
