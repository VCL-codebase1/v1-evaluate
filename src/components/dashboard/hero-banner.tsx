import { ButtonLink } from "@/components/ui/button";

export function HeroBanner({ role }: { role: string }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="text-hero-kicker">{role} workspace</p>
        <h1 className="text-hero-title">Create your quotations</h1>
        <p className="text-hero-sub">Create your first estimate</p>
      </div>
      <ButtonLink href="/rfqs/new" variant="white" size="lg">
        Create new RFQ Estimate
      </ButtonLink>
    </section>
  );
}
