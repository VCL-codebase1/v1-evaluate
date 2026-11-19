import { ButtonLink } from "@/components/ui/button";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { QuotationTable } from "@/components/dashboard/quotation-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowPanel } from "@/components/dashboard/workflow-panel";
import type { DashboardSummary, EstimateRecord } from "@/lib/types";

export function DashboardView({
  role,
  summary,
  estimates,
}: {
  role: string;
  summary: DashboardSummary;
  estimates: EstimateRecord[];
}) {
  return (
    <div className="stack">
      <HeroBanner role={role} />
      <WorkflowPanel steps={summary.steps} progress={summary.progress} />
      <div className="stat-grid">
        {summary.stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>
      <div className="action-row">
        <ButtonLink href="/rfqs/new" variant="primary" size="sm" fill>
          + New RFQ Estimate
        </ButtonLink>
        <ButtonLink href="/rfqs" variant="quiet" size="sm" fill>
          My Estimates
        </ButtonLink>
        <ButtonLink href="/approval" variant="quiet" size="sm" fill>
          Pending Approvals
        </ButtonLink>
        <ButtonLink href="/reports" variant="quiet" size="sm" fill>
          Reports
        </ButtonLink>
      </div>
      <div className="queue-grid">
        <section className="surface-card panel-card" aria-labelledby="queue-title">
          <h2 id="queue-title" className="text-panel-title">
            Quotation queue
          </h2>
          <QuotationTable estimates={estimates} />
        </section>
        <section className="surface-card panel-card notice-card" aria-labelledby="notice-title">
          <h2 id="notice-title" className="text-panel-title">
            Notification
          </h2>
          {estimates.length === 0 ? (
            <p className="notice-copy">No estimate created yet</p>
          ) : (
            <ul className="notice-list">
              {estimates.slice(0, 5).map((estimate) => (
                <li key={estimate.id}>
                  <strong>{estimate.id}</strong>
                  <span>{estimate.title || estimate.clientName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
