"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";

const GROUPS: { title: string; fields: { key: keyof PricingRules; label: string }[] }[] = [
  {
    title: "Local purchase",
    fields: [
      { key: "localPurchaseBank", label: "Bank 1 % of base" },
      { key: "localPurchaseDelivery", label: "Delivery within city % of base" },
      { key: "localPurchaseMarkup", label: "Markup % of base" },
    ],
  },
  {
    title: "Local standard and tax",
    fields: [
      { key: "localBank", label: "Bank 1 % of base" },
      { key: "localDelivery", label: "Delivery within city % of base" },
      { key: "localMarkup", label: "Markup % of base" },
      { key: "vat", label: "VAT % when selected" },
      { key: "withholding", label: "Withholding % when selected" },
      { key: "localInstallation", label: "Installation % of line total (excluded from cost)" },
    ],
  },
  {
    title: "Air freight (courier / airport)",
    fields: [
      { key: "surcharge", label: "Energy surcharge % of base" },
      { key: "airBank", label: "Bank 2 % of base" },
      { key: "customs", label: "Customs % of base + freight" },
      { key: "agency", label: "Handling / agency % of base" },
      { key: "delivery", label: "Delivery within Lagos % of base" },
      { key: "markup", label: "Markup % of base + freight" },
      { key: "soncap", label: "SONCAP amount per shipment (FX)" },
      { key: "bank1", label: "Bank 1 % of base when no item amount is entered" },
      { key: "installation", label: "Installation % of line total (excluded from cost)" },
    ],
  },
  {
    title: "Air courier overrides",
    fields: [
      { key: "courierBank", label: "Bank 2 % of base" },
      { key: "courierCustoms", label: "Customs % of base + freight" },
      { key: "courierAgency", label: "Agency % of base" },
      { key: "courierDelivery", label: "Delivery % of base" },
      { key: "courierMarkup", label: "Markup % of base + freight" },
    ],
  },
  {
    title: "Sea freight",
    fields: [
      { key: "seaSurcharge", label: "Energy surcharge % of base" },
      { key: "seaBank", label: "Bank 2 % of base" },
      { key: "insurance", label: "Insurance % of base" },
      { key: "seaCustoms", label: "Customs % of base + freight + insurance" },
      { key: "seaAgency", label: "Agency % of base" },
      { key: "shipping", label: "Shipping line % of base" },
      { key: "warehouse", label: "Terminal + warehousing % of shipping line" },
      { key: "seaDelivery", label: "Delivery % of base" },
      { key: "seaMarkup", label: "Markup % of base + freight" },
    ],
  },
  {
    title: "Not included in line cost",
    fields: [
      { key: "commission", label: "Sales-rep commission % of line total" },
    ],
  },
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
        {Object.values(rules).every((value) => value === 0) ? (
          <p className="manager-note">Set your organization’s pricing rules before pricing an estimate. The standard workbook’s monetary values are examples.</p>
        ) : null}
        {GROUPS.map((group) => (
          <section key={group.title} className="surface-card panel-card rules-grid">
            <h2 className="text-block-title">{group.title}</h2>
            {group.fields.map((field) => (
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
        ))}
        {error ? <p className="text-error" role="alert">{error}</p> : null}
        <footer className="pricing-rules-footer">
          <button type="submit" className="solid-action" disabled={!canEdit || !editing || pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <p>{canEdit === false ? "View only. An organization admin can update these rules." : "Changes never alter approved estimates. Bank 1 on foreign lines is entered per item."}</p>
        </footer>
      </form>
    </div>
  );
}
