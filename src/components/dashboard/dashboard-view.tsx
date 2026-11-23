import { ButtonLink } from "@/components/ui/button";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { QuotationTable } from "@/components/dashboard/quotation-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowPanel } from "@/components/dashboard/workflow-panel";
import type { DashboardSummary, EstimateRecord } from "@/lib/types";
import { canManageUsers, isRole } from "@/lib/auth/roles";

const MANAGER_STEPS = ["Estimate Created", "Approved by Sales Director", "Quotation Generated"] as const;

export function DashboardView({
  role,
  summary,
  estimates,
}: {
  role: string;
  summary: DashboardSummary;
  estimates: EstimateRecord[];
}) {
  const manager = role === "Line Manager";
  const waiting = estimates.filter((estimate) => estimate.reviewStage === "in_review").length;

  return (
    <div className="stack">
      <HeroBanner role={role} waiting={waiting} />
      <WorkflowPanel
        steps={manager ? MANAGER_STEPS : summary.steps}
        progress={summary.progress}
        title={manager && estimates.length === 0 ? "Estimate workflow" : "Estimate workflow · all roles"}
      />
      <div className="stat-grid">
        {summary.stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>
      <div className="action-row">
        {isRole(role) && canManageUsers(role) ? (
          <ButtonLink href="/admin/users" variant="quiet" size="sm" fill>
            Manage users
          </ButtonLink>
        ) : null}
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
          <QuotationTable estimates={estimates} role={role} />
        </section>
        <section className="surface-card panel-card notice-card" aria-labelledby="notice-title">
          <h2 id="notice-title" className="text-panel-title">
            Notification
          </h2>
          {estimates.length === 0 || manager ? (
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
