import Link from "next/link";
import type { EstimateRecord } from "@/lib/types";

function statusOf(estimate: EstimateRecord, role: string) {
  if (estimate.reviewStage === "approved") return { label: "Finally Approved", tone: "approved", review: false };
  if (estimate.reviewStage === "returned" || estimate.status === "rejected") {
    return { label: "Returned to Rep", tone: "returned", review: false };
  }
  if (estimate.reviewStage === "draft") return { label: "Draft", tone: "draft", review: false };
  const waitingOnDirector = estimate.workflowStep === "sales_director";
  return {
    label: waitingOnDirector
      ? (role === "Sales Director" ? "Under your Final Review" : "Under Sales Director Review")
      : "Under Line Manager Review",
    tone: "review",
    review: (role === "Line Manager" && !waitingOnDirector) || (role === "Sales Director" && waitingOnDirector),
  };
}

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function cell(value: string) {
  return value.trim() ? value : "—";
}

function defaultHref(estimate: EstimateRecord, review: boolean) {
  if (review) return `/approval?estimate=${encodeURIComponent(estimate.id)}`;
  if (estimate.reviewStage === "draft" || estimate.reviewStage === "returned") {
    return `/estimation?estimate=${encodeURIComponent(estimate.id)}`;
  }
  return `/approval?estimate=${encodeURIComponent(estimate.id)}`;
}

export function QuotationTable({
  estimates,
  role = "Representative",
  viewHref,
}: {
  estimates: EstimateRecord[];
  role?: string;
  viewHref?: (estimate: EstimateRecord) => string;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
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
          {estimates.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={7}>
                No quotation yet
              </td>
            </tr>
          ) : (
            estimates.map((estimate) => {
              const status = statusOf(estimate, role);
              const href = viewHref?.(estimate) ?? defaultHref(estimate, status.review);
              return (
              <tr key={estimate.id}>
                <td className="cell-strong">{estimate.id}</td>
                <td>{cell(estimate.qref)}</td>
                <td>
                  {cell(estimate.clientName)}
                  {estimate.clientName ? <span> · by {estimate.originator || "—"}</span> : null}
                </td>
                <td>{cell(estimate.title)}</td>
                <td>
                  <span className={`queue-pill is-${status.tone}`}>{status.label}</span>
                  {status.review ? <span className="needs-you">Needs you</span> : null}
                </td>
                <td>{money(estimate.totalNgn)}</td>
                <td>
                  <Link href={href} className="queue-action">
                    {status.review ? "Review" : "View"}
                  </Link>
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
