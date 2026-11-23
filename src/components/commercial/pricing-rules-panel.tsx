"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_RULES, type PricingRules } from "@/lib/db/commercial";

const FIELDS: { key: keyof PricingRules; label: string }[] = [
  { key: "airBank", label: "Air/Sea bank charges %" },
  { key: "customs", label: "Customs duties % of base+freight" },
  { key: "agency", label: "Agency charges %" },
  { key: "delivery", label: "Delivery charges %" },
  { key: "warehouse", label: "Warehouse & terminal % (sea)" },
  { key: "markup", label: "Markup % of base+freight" },
  { key: "soncap", label: "SONCAP USD per RFQ" },
  { key: "localBank", label: "Local bank charges %" },
  { key: "localDelivery", label: "Local delivery charges %" },
  { key: "localMarkup", label: "Local markup %" },
  { key: "bank1", label: "Bank 1 %" },
];

export function PricingRulesPanel() {
  const [rules, setRules] = useState<PricingRules>(DEFAULT_RULES);
  const [canEdit, setCanEdit] = useState(false);
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
    if (!canEdit) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/pricing-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Unable to save pricing rules.");
      return;
    }
    setRules(payload.rules);
    setEditing(false);
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">Pricing rules</h1>
        {canEdit ? (
          <button type="button" className="ghost-action" onClick={() => setEditing((current) => !current)}>Edit</button>
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
                readOnly={!editing}
                onChange={(event) => setRules((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </section>
        <p className="text-subtitle">Changes never alter approved estimates.</p>
        {error ? <p className="text-error" role="alert">{error}</p> : null}
        {canEdit ? <button type="submit" className="solid-action" disabled={pending}>{pending ? "Saving…" : "Save rates"}</button> : null}
      </form>
    </div>
  );
}
