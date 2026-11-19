import Link from "next/link";
import type { EstimateRecord, EstimateStatus } from "@/lib/types";

const STATUS_LABEL: Record<EstimateStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Returned",
};

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(value);
}

function cell(value: string) {
  return value.trim() ? value : "—";
}

export function QuotationTable({ estimates }: { estimates: EstimateRecord[] }) {
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
            estimates.map((estimate) => (
              <tr key={estimate.id}>
                <td className="cell-strong">{estimate.id}</td>
                <td>{cell(estimate.clientName)}</td>
                <td>{cell(estimate.title)}</td>
                <td>{STATUS_LABEL[estimate.status]}</td>
                <td>{money(estimate.totalNgn)}</td>
                <td>
                  <Link href={`/approval?estimate=${estimate.id}`} className="table-action">
                    View
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
