"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { canManageExchangeRates } from "@/lib/auth/roles";
import type { ExchangeRateTable } from "@/lib/types";

const EMPTY_RATES: ExchangeRateTable = { NGN: 1, USD: 0, EUR: 0, GBP: 0 };

export function ExchangeRatesPanel() {
  const [rates, setRates] = useState<ExchangeRateTable>(EMPTY_RATES);
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
        setRates({ ...EMPTY_RATES, ...(ratesPayload.rates ?? {}) });
        setCanEdit(canManageExchangeRates(sessionPayload?.user?.role ?? ""));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load exchange rates.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
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
      setRates({ ...EMPTY_RATES, ...(payload.rates ?? {}) });
      setMessage("Exchange rates saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save exchange rates.");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <section className="surface-card panel-card">Loading organization rates…</section>;

  return (
    <section className="surface-card panel-card">
      <form className="form-fields" onSubmit={onSubmit}>
        <div className="rate-grid">
          {(["USD", "EUR", "GBP"] as const).map((currency) => (
            <TextField
              key={currency}
              label={`${currency} / NGN`}
              name={currency}
              type="number"
              min="0.000001"
              step="any"
              value={rates[currency] > 0 ? rates[currency] : ""}
              readOnly={!canEdit}
              required={canEdit}
              onChange={(event) =>
                setRates((current) => ({ ...current, [currency]: Number(event.target.value) }))
              }
            />
          ))}
        </div>
        {error ? <p className="text-error" role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        {canEdit ? (
          <Button type="submit" disabled={pending}>{pending ? "Saving rates…" : "Save rates"}</Button>
        ) : (
          <p className="text-subtitle">View only. A Sales Director sets these rates.</p>
        )}
      </form>
    </section>
  );
}
