import { Logo } from "@/components/brand/logo";
import { CheckIcon } from "@/components/layout/icons";

export function AuthShowcase() {
  return (
    <section className="auth-showcase" aria-label="Product preview">
      <span className="auth-glow auth-glow-top" aria-hidden="true" />
      <span className="auth-glow auth-glow-stats" aria-hidden="true" />
      <div className="auth-showcase-inner">
        <Logo>V11-Estimate</Logo>
        <div className="auth-copy">
          <p className="text-kicker">RFQ & tender pricing, reimagined</p>
          <h1 className="text-display">
            Price every RFQ in
            <br />
            minutes, not days.
          </h1>
          <p className="text-lede">
            One controlled workspace for sourcing costs, exchange rates, markup
            and approvals. Say goodbye to scattered spreadsheets.
          </p>
          <p className="auth-check text-check">
            <CheckIcon width={20} height={20} />
            Local, air and sea costs calculated automatically
          </p>
          <p className="auth-check text-check">
            <CheckIcon width={20} height={20} />
            Exchange rates and approvals scoped to your organization
          </p>
          <p className="auth-check text-check">
            <CheckIcon width={20} height={20} />
            RFQs, estimates and audit history stored in your workspace
          </p>
        </div>
      </div>
    </section>
  );
}
