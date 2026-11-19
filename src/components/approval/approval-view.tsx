"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { formatGrandTotal, formatSoncap, summarizeSheet } from "@/lib/estimation";
import type { ExchangeRateTable, SheetRecord } from "@/lib/types";

function versionLabel(version: string) {
  return `Version ${version.replace(/^v/i, "")}`;
}

type ApprovalPayload = SheetRecord & { rates: ExchangeRateTable };

export function ApprovalPanel() {
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/approval")
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data: ApprovalPayload) => {
        if (active) setPayload(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!payload) {
    return (
      <div className="page-stack">
        <div className="approval-heading">
          <h1 className="text-page-title">Approval</h1>
          <p className="approval-kicker">
            {failed ? "The review could not be loaded." : "Loading the review…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ApprovalView
      sheet={payload}
      rates={payload.rates}
      role={payload.submittedBy || "Representative"}
    />
  );
}

export function ApprovalView({
  sheet,
  rates,
  role,
}: {
  sheet: SheetRecord;
  rates: ExchangeRateTable;
  role: string;
}) {
  const summary = summarizeSheet(sheet.lines, rates);
  const named = summary.lines.filter((line) => line.item.trim());
  const inReview = sheet.reviewStage === "in_review" || sheet.reviewStage === "approved";

  return (
    <div className="page-stack">
      <div className="approval-heading">
        <h1 className="text-page-title">Approval</h1>
        <p className="approval-kicker">
          Estimation sheet / {sheet.estimateId}
        </p>
      </div>

      {inReview ? (
        <>
          <section className="surface-card panel-card approval-banner">
            <div className="approval-banner-copy">
              <span className="approval-check" aria-hidden>
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path
                    d="M6.5 12.2 10.2 16l7.3-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h2>Estimate submitted for review</h2>
                <p>
                  {sheet.estimateId} · {sheet.version} is now awaiting approval. You can track its progress below.
                </p>
              </div>
            </div>
            <span className="review-pill">
              {sheet.reviewStage === "approved" ? "Approved" : "Under line manager review"}
            </span>
          </section>

          <div className="approval-grid">
            <section className="surface-card panel-card">
              <div className="approval-section-head">
                <h2>Estimate summary</h2>
                <p>
                  {summary.itemCount} item{summary.itemCount === 1 ? "" : "s"} · {sheet.version}
                </p>
              </div>
              <div className="table-scroll">
                <table className="data-table approval-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Source</th>
                      <th scope="col">Qty</th>
                      <th scope="col">Total (NGN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {named.map((line) => (
                      <tr key={line.id}>
                        <td className="approval-item">{line.item}</td>
                        <td>{line.source}</td>
                        <td>{line.qty || "0"}</td>
                        <td>{formatGrandTotal(line.totalNgn)}</td>
                      </tr>
                    ))}
                    <tr className="approval-grand-row">
                      <td colSpan={3}>Grand total (NGN)</td>
                      <td className="approval-grand">{formatGrandTotal(summary.grandTotalNgn)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="approval-soncap">
                SONCAP allocated USD {formatSoncap(summary.soncapUsd)} · Locked when approved
              </p>
            </section>

            <section className="surface-card panel-card">
              <h2 className="progress-title">Review progress</h2>
              <ol className="progress-list">
                <li>
                  <span className="progress-index is-done">1</span>
                  <div>
                    <p className="progress-name is-submitted">Submitted</p>
                    <p className="progress-detail">Estimate sent for review</p>
                  </div>
                </li>
                <li>
                  <span className={sheet.reviewStage === "approved" ? "progress-index is-done" : "progress-index is-current"}>
                    2
                  </span>
                  <div>
                    <p className={sheet.reviewStage === "approved" ? "progress-name is-submitted" : "progress-name is-pending"}>
                      Pending review
                    </p>
                    <p className="progress-detail">
                      {sheet.reviewStage === "approved" ? "Line manager approved" : "Awaiting an approval decision"}
                    </p>
                  </div>
                </li>
                <li>
                  <span className={sheet.reviewStage === "approved" ? "progress-index is-done" : "progress-index"}>3</span>
                  <div>
                    <p className={sheet.reviewStage === "approved" ? "progress-name is-submitted" : "progress-name is-waiting"}>
                      Decision
                    </p>
                    <p className="progress-detail">
                      {sheet.reviewStage === "approved" ? "Estimate approved and locked" : "Approval or changes requested"}
                    </p>
                  </div>
                </li>
              </ol>
              <p className="progress-lock">The estimate will be locked once it is approved.</p>
            </section>
          </div>

          <div className="approval-footer">
            <p>Submitted by {sheet.submittedBy || role} · {versionLabel(sheet.version)}</p>
            <div className="form-actions">
              <ButtonLink href="/estimation" variant="quiet" size="sm">
                Back to estimation sheet
              </ButtonLink>
              <ButtonLink href="/estimation" variant="primary" size="sm">
                View submitted estimate
              </ButtonLink>
            </div>
          </div>
        </>
      ) : (
        <section className="surface-card panel-card approval-empty">
          <h2>No estimate is in review</h2>
          <p>Submit the estimation sheet and the line manager review will appear here.</p>
          <Link href="/estimation" className="table-action">
            Open estimation sheet
          </Link>
        </section>
      )}
    </div>
  );
}
