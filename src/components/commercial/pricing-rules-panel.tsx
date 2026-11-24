"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";

const FIELDS: { key: keyof PricingRules; label: string }[] = [
  { key: "airBank", label: "Air/Sea bank charges %" },
  { key: "customs", label: "Customs duties % of base+freight" },
  { key: "agency", label: "Agency charges %" },
  { key: "delivery", label: "Delivery charges %" },
  { key: "markup", label: "Markup % of base+freight" },
  { key: "soncap", label: "SONCAP USD per RFQ" },
  { key: "localBank", label: "Local bank charges %" },
  { key: "localDelivery", label: "Local delivery charges %" },
  { key: "localMarkup", label: "Local markup %" },
  { key: "bank1", label: "Bank 1 %" },
  { key: "courierBank", label: "Courier bank 2 %" },
  { key: "courierCustoms", label: "Courier customs %" },
  { key: "courierAgency", label: "Courier agency %" },
  { key: "courierDelivery", label: "Courier delivery %" },
  { key: "courierMarkup", label: "Courier markup %" },
  { key: "seaCustoms", label: "Sea customs %" },
  { key: "seaAgency", label: "Sea agency %" },
  { key: "seaDelivery", label: "Sea delivery %" },
  { key: "shipping", label: "Sea shipping line %" },
  { key: "surcharge", label: "Energy surcharge %" },
  { key: "insurance", label: "Sea insurance %" },
  { key: "installation", label: "Foreign installation %" },
  { key: "localInstallation", label: "Local installation %" },
  { key: "vat", label: "Local VAT %" },
  { key: "withholding", label: "Local withholding %" },
  { key: "commission", label: "Sales commission %" },
  { key: "localPurchaseBank", label: "Local purchase bank %" },
  { key: "localPurchaseMarkup", label: "Local purchase markup %" },
  { key: "localPurchaseDelivery", label: "Local purchase delivery %" },
];

export function PricingRulesPanel() {
  const [rules, setRules] = useState<PricingRules>(DEFAULT_RULES);
  const [canEdit, setCanEdit] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/pricing-rules")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load pricing rules.");
        setRules(payload.rules);
        setCanEdit(Boolean(payload.canEdit));
        setEditing(Boolean(payload.canEdit));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load pricing rules."));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !editing || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/pricing-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save pricing rules.");
      setRules(payload.rules);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save pricing rules.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">Pricing rules</h1>
        {canEdit && !editing ? (
          <button type="button" className="ghost-action" onClick={() => setEditing(true)}>Edit</button>
        ) : null}
      </div>
      <form onSubmit={onSubmit}>
        <section className="surface-card panel-card rules-grid">
          {FIELDS.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                type="number"
                step="any"
                value={rules[field.key]}
                readOnly={!editing || pending}
                onChange={(event) => setRules((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </section>
        {error ? <p className="text-error" role="alert">{error}</p> : null}
        <footer className="pricing-rules-footer">
          <button type="submit" className="solid-action" disabled={!canEdit || !editing || pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <p>{canEdit === false ? "View only. An organization admin can update these rules." : "Changes never alter approved estimates."}</p>
        </footer>
      </form>
    </div>
  );
}
