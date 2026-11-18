import { ButtonLink } from "@/components/ui/button";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkflowPanel } from "@/components/dashboard/workflow-panel";
import type { DashboardSummary } from "@/lib/types";

export function DashboardView({
  role,
  summary,
}: {
  role: string;
  summary: DashboardSummary;
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
        <ButtonLink href="/rfqs/new" variant="primary" size="md">
          + New RFQ Estimate
        </ButtonLink>
        <ButtonLink href="/rfqs/new" variant="outline" size="md">
          + New RFQ Estimate
        </ButtonLink>
      </div>
    </div>
  );
}
