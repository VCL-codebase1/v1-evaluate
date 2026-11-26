import { attachmentName, attachmentUrl, displayValue, formatDateField } from "@/lib/format-display";
import type { EstimateRecord } from "@/lib/types";

export function RfqDetailsCard({ estimate }: { estimate: EstimateRecord }) {
  const fields = [
    { label: "Client name", value: displayValue(estimate.clientName) },
    { label: "Qref", value: displayValue(estimate.qref) },
    { label: "Client RFQ / tender number", value: displayValue(estimate.tenderNumber) },
    { label: "RFQ title", value: displayValue(estimate.title) },
    { label: "Contact person", value: displayValue(estimate.contact) },
    { label: "Client department", value: displayValue(estimate.department) },
    { label: "Date received", value: formatDateField(estimate.dateReceived) },
    { label: "Submission deadline", value: formatDateField(estimate.deadline) },
    { label: "Account manager", value: displayValue(estimate.accountManager) },
    { label: "Originator", value: displayValue(estimate.originator) },
    { label: "Description", value: displayValue(estimate.description) },
    { label: "Remarks", value: displayValue(estimate.remarks) },
  ];

  return (
    <section className="surface-card approvals-card" aria-labelledby="rfq-details-title">
      <h2 id="rfq-details-title">RFQ registration details</h2>
      <dl className="rfq-details-grid">
        {fields.map((field) => (
          <div key={field.label} className="rfq-detail">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
        <div className="rfq-detail">
          <dt>Attachments</dt>
          <dd>
            {estimate.attachments.length === 0 ? (
              "—"
            ) : (
              <ul className="file-list">
                {estimate.attachments.map((entry) => (
                  <li key={entry}>
                    <a className="text-link" href={attachmentUrl(entry)} target="_blank" rel="noreferrer">
                      {attachmentName(entry)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
