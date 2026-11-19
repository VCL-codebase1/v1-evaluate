import Link from "next/link";
import type { EstimateRecord } from "@/lib/types";

function statusOf(estimate: EstimateRecord, manager: boolean) {
  if (estimate.reviewStage === "approved") return { label: "Finally Approved", tone: "approved", review: false };
  if (estimate.reviewStage === "returned" || estimate.status === "rejected") {
    return { label: "Returned to Rep", tone: "returned", review: false };
  }
  if (estimate.reviewStage === "draft") return { label: "Draft", tone: "draft", review: false };
  return {
    label: "Under Line Manager Review",
    tone: "review",
    review: manager,
  };
}

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function cell(value: string) {
  return value.trim() ? value : "—";
}

export function QuotationTable({
  estimates,
  role = "Representative",
}: {
  estimates: EstimateRecord[];
  role?: string;
}) {
  const manager = role === "Line Manager";
  return (
    <div className="table-scroll">
      <table className="data-table">
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
          {estimates.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={6}>
                No quotation yet
              </td>
            </tr>
          ) : (
            estimates.map((estimate) => {
              const status = statusOf(estimate, manager);
              return (
              <tr key={estimate.id}>
                <td className="cell-strong">{estimate.id}</td>
                <td>
                  {cell(estimate.clientName)}
                  {estimate.clientName ? <span> · by {estimate.originator || "Rep 1"}</span> : null}
                </td>
                <td>{cell(estimate.title)}</td>
                <td>
                  <span className={`queue-pill is-${status.tone}`}>{status.label}</span>
                  {status.review ? <span className="needs-you">Needs you</span> : null}
                </td>
                <td>{money(estimate.totalNgn)}</td>
                <td>
                  <Link href={`/approval?estimate=${estimate.id}`} className="queue-action">
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
