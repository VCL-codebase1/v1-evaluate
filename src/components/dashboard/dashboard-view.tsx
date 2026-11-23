import { ButtonLink } from "@/components/ui/button";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { QuotationTable } from "@/components/dashboard/quotation-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowPanel } from "@/components/dashboard/workflow-panel";
import type { DashboardSummary, EstimateRecord } from "@/lib/types";

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
    <div className="stack dashboard-page">
      <HeroBanner role={role} waiting={waiting} />
      <div className="stat-grid">
        {summary.stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>
      <section className="surface-card panel-card" aria-labelledby="queue-title">
        <div className="queue-heading">
          <h2 id="queue-title" className="text-panel-title">Quotation queue</h2>
          <ButtonLink href="/rfqs" variant="quiet" size="sm">View all estimates</ButtonLink>
        </div>
        <QuotationTable estimates={estimates} role={role} />
      </section>
      <WorkflowPanel
        steps={manager ? MANAGER_STEPS : summary.steps}
        progress={summary.progress}
        title="Estimate workflow"
      />
    </div>
  );
}
