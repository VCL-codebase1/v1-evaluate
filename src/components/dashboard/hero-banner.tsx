import { ButtonLink } from "@/components/ui/button";

export function HeroBanner({ role, waiting }: { role: string; waiting?: number }) {
  const manager = role === "Line Manager";
  const queued = waiting ?? 0;

  if (manager && queued > 0) {
    return (
      <section className="hero hero-manager">
        <div className="hero-copy">
          <p className="text-hero-kicker">Line Manager workspace</p>
          <h1 className="text-hero-title">
            {queued} quotation{queued === 1 ? "" : "s"} waiting for your review
          </h1>
          <p className="text-hero-sub">New submissions from your representatives.</p>
        </div>
        <ButtonLink href="/approval" variant="white" size="hero">
          Open Queue
        </ButtonLink>
      </section>
    );
  }

  if (manager) {
    return (
      <section className="hero hero-manager">
        <div className="hero-copy">
          <p className="text-hero-kicker">Line Manager workspace</p>
          <h1 className="text-hero-title">Create your first quotation</h1>
          <p className="text-hero-sub">Register an RFQ to begin.</p>
        </div>
        <ButtonLink href="/rfqs/new" variant="white" size="hero">
          New RFQ
        </ButtonLink>
      </section>
    );
  }

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="text-hero-kicker">{role} workspace</p>
        <h1 className="text-hero-title">Create your quotations</h1>
        <p className="text-hero-sub">Create your first estimate</p>
      </div>
      <ButtonLink href="/rfqs/new" variant="white" size="hero" fill>
        Create new RFQ Estimate
      </ButtonLink>
    </section>
  );
}
