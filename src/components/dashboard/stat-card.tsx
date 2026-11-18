import {
  CheckGlyph,
  ClockGlyph,
  DocumentGlyph,
  ReturnGlyph,
} from "@/components/layout/icons";
import type { DashboardStat } from "@/lib/types";

const ICONS = {
  purple: DocumentGlyph,
  orange: ClockGlyph,
  green: CheckGlyph,
  red: ReturnGlyph,
} as const;

export function StatCard({ stat }: { stat: DashboardStat }) {
  const Icon = ICONS[stat.tone];

  return (
    <article className="stat-card">
      <span className={`stat-icon ${stat.tone}`}>
        <Icon />
      </span>
      <div>
        <p className="text-stat-label">{stat.label}</p>
        <p className="text-stat-count">{stat.value}</p>
      </div>
    </article>
  );
}
