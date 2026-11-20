"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { canManageExchangeRates } from "@/lib/auth/roles";
import type { ExchangeRateTable } from "@/lib/types";

export function ExchangeRatesPanel() {
  const [rates, setRates] = useState<Partial<ExchangeRateTable>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/exchange-rates"), fetch("/api/auth/session")])
      .then(async ([ratesResponse, sessionResponse]) => {
        const ratesPayload = await ratesResponse.json();
        const sessionPayload = sessionResponse.ok ? await sessionResponse.json() : null;
        if (!active) return;
        if (!ratesResponse.ok) throw new Error(ratesPayload.error || "Unable to load exchange rates.");
        setRates(ratesPayload.rates ?? {});
        setCanEdit(canManageExchangeRates(sessionPayload?.user?.role ?? ""));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load exchange rates.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/exchange-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save exchange rates.");
      setRates(payload.rates);
      setMessage("Exchange rates saved for this organization.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save exchange rates.");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <section className="surface-card panel-card">Loading organization rates…</section>;
  if (error && !Object.keys(rates).length) return <p className="text-error" role="alert">{error}</p>;

  return (
    <section className="surface-card panel-card">
      <p>Rates are stored per organization and used to convert estimate values to NGN.</p>
      <form className="form-fields" onSubmit={onSubmit}>
        <TextField label="NGN per USD" name="USD" type="number" min="0.000001" step="any" value={rates.USD && rates.USD > 0 ? rates.USD : ""} readOnly={!canEdit} required onChange={(event) => setRates((current) => ({ ...current, USD: Number(event.target.value) }))} />
        <TextField label="NGN per EUR" name="EUR" type="number" min="0.000001" step="any" value={rates.EUR && rates.EUR > 0 ? rates.EUR : ""} readOnly={!canEdit} required onChange={(event) => setRates((current) => ({ ...current, EUR: Number(event.target.value) }))} />
        <TextField label="NGN per GBP" name="GBP" type="number" min="0.000001" step="any" value={rates.GBP && rates.GBP > 0 ? rates.GBP : ""} readOnly={!canEdit} required onChange={(event) => setRates((current) => ({ ...current, GBP: Number(event.target.value) }))} />
        <p className="text-subtitle">NGN is fixed at 1 NGN per NGN.</p>
        {error ? <p className="text-error" role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        {canEdit ? <Button type="submit" disabled={pending}>{pending ? "Saving rates…" : "Save exchange rates"}</Button> : <p>You can view rates. An organization administrator can update them.</p>}
      </form>
    </section>
  );
}
