"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { canManageExchangeRates } from "@/lib/auth/roles";
import {
  DEFAULT_RATES,
  formatAmount,
  formatGrandTotal,
  summarizeSheet,
} from "@/lib/estimation";
import { applySource, blankSheetLine, isLocalSource } from "@/lib/sheet-line";
import type { ExchangeRateTable, ReviewStage, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";

const RATE_FIELDS = [
  { currency: "GBP" as const, label: "GBP / NGN" },
  { currency: "EUR" as const, label: "EUR / NGN" },
  { currency: "USD" as const, label: "USD / NGN" },
];

const SOURCES: SourceMode[] = ["Local", "Air", "Sea"];
const CURRENCIES: SheetCurrency[] = ["NGN", "USD", "EUR", "GBP"];

function Dash() {
  return <span className="manager-na">—</span>;
}

export function EstimationSheet({
  estimateId,
  version = "v1",
  mode = "originator",
}: {
  estimateId: string;
  version?: string;
  mode?: "originator" | "reviewer";
}) {
  const router = useRouter();
  const estimateIdRef = useRef(estimateId);
  const scroller = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<SheetLine[]>(() => [blankSheetLine("line-1")]);
  const [setAll, setSetAll] = useState<SourceMode>("Local");
  const [rates, setRates] = useState<ExchangeRateTable>(DEFAULT_RATES);
  const [rules, setRules] = useState<PricingRules>(DEFAULT_RULES);
  const [reviewStage, setReviewStage] = useState<ReviewStage>("draft");
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState(true);
  const [pending, setPending] = useState<"save" | "submit" | "rates" | null>(null);
  const [canEditRates, setCanEditRates] = useState(false);
  const [message, setMessage] = useState("");

  const locked = mode === "originator" && (reviewStage === "in_review" || reviewStage === "approved");
  const summary = useMemo(() => summarizeSheet(lines, rates, rules), [lines, rates, rules]);
  const missingRates = [...new Set(
    lines.filter((line) => !isLocalSource(line) && line.currency !== "NGN" && rates[line.currency] <= 0).map((line) => line.currency),
  )];

  useEffect(() => {
    let active = true;
    async function load() {
      const sessionResponse = await fetch("/api/auth/session");
      const sessionPayload = sessionResponse.ok
        ? ((await sessionResponse.json()) as { user?: { estimateId?: string; role?: string } })
        : null;
      const id = sessionPayload?.user?.estimateId || estimateId;
      if (active) setCanEditRates(canManageExchangeRates(sessionPayload?.user?.role ?? ""));
      estimateIdRef.current = id;
      const response = await fetch(`/api/estimates/${id}/sheet`);
      if (!response.ok) {
        if (active) setLoading(false);
        return;
      }
      const payload = (await response.json()) as {
        lines: SheetLine[];
        rates: ExchangeRateTable;
        rules: PricingRules;
        reviewStage: ReviewStage;
      };
      if (!active) return;
      if (payload.lines?.length) {
        setLines(payload.lines.map((line) => ({ ...blankSheetLine(line.id, line.source), ...line })));
      }
      setRates(payload.rates ?? DEFAULT_RATES);
      setRules(payload.rules ?? DEFAULT_RULES);
      setReviewStage(payload.reviewStage ?? "draft");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [estimateId]);

  function applySetAll(next: SourceMode) {
    setSetAll(next);
    setLines((current) => current.map((line) => applySource(line, next)));
  }

  function updateLine(id: string, patch: Partial<SheetLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.source) return applySource(next, patch.source);
        if (patch.sourcing === "Local") return applySource(next, "Local");
        if (patch.sourcing === "Foreign" && next.source === "Local") return applySource(next, "Air");
        return next;
      }),
    );
  }

  async function persistRates() {
    if (!canEditRates) return true;
    const response = await fetch("/api/exchange-rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rates }),
    });
    const payload = (await response.json()) as { error?: string; rates?: ExchangeRateTable };
    if (!response.ok) {
      setMessage(payload.error ?? "Unable to save exchange rates.");
      return false;
    }
    if (payload.rates) setRates({ ...DEFAULT_RATES, ...payload.rates });
    return true;
  }

  async function saveDraft() {
    setMessage("");
    if (missingRates.length > 0) {
      setMessage(`Set an NGN exchange rate for ${missingRates.join(", ")} above before saving.`);
      return;
    }
    setPending("save");
    if (!(await persistRates())) {
      setPending(null);
      return;
    }
    const response = await fetch(`/api/estimates/${estimateIdRef.current}/sheet`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const payload = (await response.json()) as { error?: string; reviewStage?: ReviewStage };
    setPending(null);
    if (!response.ok) {
      setMessage(payload.error ?? "Unable to save this draft.");
      return;
    }
    if (payload.reviewStage) setReviewStage(payload.reviewStage);
    setMessage("Draft saved.");
  }

  async function submit() {
    setMessage("");
    const named = lines.filter((line) => line.item.trim());
    if (named.length === 0) {
      setMessage("Add an item before submitting for review.");
      return;
    }
    setPending("submit");
    if (!(await persistRates())) {
      setPending(null);
      return;
    }
    const saved = await fetch(`/api/estimates/${estimateIdRef.current}/sheet`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    if (!saved.ok) {
      const payload = (await saved.json()) as { error?: string };
      setPending(null);
      setMessage(payload.error ?? "Unable to save this sheet.");
      return;
    }
    const submitted = await fetch(`/api/estimates/${estimateIdRef.current}/submit`, { method: "POST" });
    const payload = (await submitted.json()) as { error?: string };
    setPending(null);
    if (!submitted.ok) {
      setMessage(payload.error ?? "Unable to submit this estimate.");
      return;
    }
    router.push(`/approval?estimate=${estimateIdRef.current}`);
    router.refresh();
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">Estimation sheet</h1>
        {mode === "originator" ? (
          <Button type="button" variant="primary" size="sm" onClick={submit} disabled={locked || pending !== null || missingRates.length > 0}>
            {locked ? "Submitted for review" : pending === "submit" ? "Submitting…" : "Submit for review"}
          </Button>
        ) : (
          <button type="button" className="add-item-btn" onClick={() => void saveDraft()} disabled={pending !== null || missingRates.length > 0}>
            {pending === "save" ? "Saving…" : "Save sheet"}
          </button>
        )}
      </div>

      <section className="surface-card panel-card sheet-rates-card">
        <div className="sheet-rates-head">
          <div>
            <h2 className="text-block-title">Exchange rates</h2>
            <p className="manager-note">Set GBP, EUR, and USD to Naira before entering line items. These are the same values as Exchange rates in the sidebar.</p>
          </div>
          {canEditRates && !locked ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={pending !== null}
              onClick={async () => {
                setMessage("");
                setPending("rates");
                const saved = await persistRates();
                setPending(null);
                if (saved) setMessage("Exchange rates saved.");
              }}
            >
              {pending === "rates" ? "Saving rates…" : "Save rates"}
            </Button>
          ) : null}
        </div>
        <div className="rate-grid">
          {RATE_FIELDS.map((field) => (
            <TextField
              key={field.currency}
              label={field.label}
              name={`sheet-${field.currency}`}
              type="number"
              min="0.000001"
              step="any"
              value={rates[field.currency] > 0 ? rates[field.currency] : ""}
              readOnly={locked}
              onChange={(event) =>
                setRates((current) => ({ ...current, [field.currency]: Number(event.target.value) }))
              }
            />
          ))}
        </div>
        {!canEditRates ? (
          <p className="manager-note">These rates apply to this sheet’s NGN totals as you type. A Sales Director can save them for the organization from here or from Exchange rates.</p>
        ) : null}
      </section>

      <div className="sheet-toolbar">
        <div className="set-all">
          <span>Set all:</span>
          {SOURCES.map((option) => (
            <button
              key={option}
              type="button"
              className={option === setAll ? "mode-chip is-selected" : "mode-chip"}
              onClick={() => applySetAll(option)}
              disabled={locked}
            >
              {option === "Air" ? "Air freight" : option === "Sea" ? "Sea freight" : "Local"}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setLines((current) => [...current, blankSheetLine(crypto.randomUUID(), setAll)])}
            disabled={locked}
          >
            + Add item
          </Button>
          {mode === "originator" ? (
            <Button type="button" variant="quiet" size="sm" onClick={saveDraft} disabled={locked || pending !== null || missingRates.length > 0}>
              {pending === "save" ? "Saving…" : "Save draft"}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="manager-note">
        Local purchase has no freight. Air (courier/airport) and sea freight use the quote-analysis columns from the evaluation template. Commission and installation are shown for bonus only and are not in the line cost.
      </p>
      {message ? <p className="sheet-message">{message}</p> : null}
      {missingRates.length > 0 ? (
        <p className="text-error" role="alert">
          Set an NGN exchange rate for {missingRates.join(", ")} above before saving or submitting.
        </p>
      ) : null}

      <section className="surface-card panel-card manager-sheet" aria-busy={loading}>
        <div className="manager-scroll-wrap">
          {hint ? (
            <div className="swipe-hint" aria-hidden>
              <span className="swipe-hint-hand">←</span>
              Swipe left
            </div>
          ) : null}
          <div
            className="manager-scroll"
            ref={scroller}
            onScroll={(event) => {
              if (event.currentTarget.scrollLeft > 12) setHint(false);
            }}
          >
            <table className="data-table manager-table sheet-table">
              <thead>
                <tr>
                  {[
                    "#",
                    "Item description",
                    "Manufacturer",
                    "Model",
                    "Part number",
                    "Specification",
                    "Qty",
                    "UOM",
                    "Supplier",
                    "Source",
                    "Currency",
                    "Base price",
                    "Other charges",
                    "Energy surcharge",
                    "Insurance",
                    "Bank 1",
                    "Bank 2",
                    "Freight",
                    "Customs",
                    "SONCAP",
                    "Shipping line",
                    "Terminal + warehouse",
                    "Agency",
                    "Delivery (city / Lagos)",
                    "Delivery outside Lagos",
                    "Markup",
                    "Subtotal (FX)",
                    "Ex-rate",
                    "Unit (NGN)",
                    "Grand total (NGN)",
                    "Installation % (not in cost)",
                    "Sales commission (not in cost)",
                    "SONCAP applies",
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line, index) => {
                  const local = isLocalSource(line);
                  const sea = !local && line.source === "Sea";
                  return (
                    <tr key={line.id}>
                      <td className="sticky-col sheet-index">{index + 1}</td>
                      <td className="sticky-col sticky-second">
                        <input className="sheet-input sheet-input-item" value={line.item} disabled={locked} aria-label={`Item ${index + 1}`} onChange={(event) => updateLine(line.id, { item: event.target.value })} />
                      </td>
                      <td><input className="sheet-input" value={line.manufacturer ?? ""} disabled={locked} aria-label={`Manufacturer ${index + 1}`} onChange={(event) => updateLine(line.id, { manufacturer: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.model ?? ""} disabled={locked} aria-label={`Model ${index + 1}`} onChange={(event) => updateLine(line.id, { model: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.partNumber ?? ""} disabled={locked} aria-label={`Part number ${index + 1}`} onChange={(event) => updateLine(line.id, { partNumber: event.target.value })} /></td>
                      <td><input className="sheet-input sheet-input-item" value={line.specification ?? ""} disabled={locked} aria-label={`Specification ${index + 1}`} onChange={(event) => updateLine(line.id, { specification: event.target.value })} /></td>
                      <td><input className="sheet-input sheet-input-num" value={line.qty} disabled={locked} aria-label={`Quantity ${index + 1}`} onChange={(event) => updateLine(line.id, { qty: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.unit ?? ""} disabled={locked} aria-label={`Unit ${index + 1}`} onChange={(event) => updateLine(line.id, { unit: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.supplier ?? ""} disabled={locked} aria-label={`Supplier ${index + 1}`} onChange={(event) => updateLine(line.id, { supplier: event.target.value })} /></td>
                      <td>
                        <select className="sheet-select" value={line.source} disabled={locked} aria-label={`Source ${index + 1}`} onChange={(event) => updateLine(line.id, { source: event.target.value as SourceMode })}>
                          {SOURCES.map((source) => (
                            <option key={source}>{source}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="sheet-select" value={local ? "NGN" : line.currency} disabled={locked || local} aria-label={`Currency ${index + 1}`} onChange={(event) => updateLine(line.id, { currency: event.target.value as SheetCurrency })}>
                          {CURRENCIES.map((currency) => (
                            <option key={currency}>{currency}</option>
                          ))}
                        </select>
                      </td>
                      <td><input className="sheet-input sheet-input-num" value={line.base} disabled={locked} aria-label={`Base ${index + 1}`} onChange={(event) => updateLine(line.id, { base: event.target.value })} /></td>
                      <td><input className="sheet-input sheet-input-num" value={line.msc} disabled={locked} aria-label={`Other charges ${index + 1}`} onChange={(event) => updateLine(line.id, { msc: event.target.value })} /></td>
                      <td>{local ? <Dash /> : formatAmount(line.surcharge)}</td>
                      <td>{sea ? formatAmount(line.insurance) : <Dash />}</td>
                      <td>
                        {local ? (
                          formatAmount(line.bank)
                        ) : (
                          <input className="sheet-input sheet-input-num" value={line.bank1Amount ?? ""} disabled={locked} aria-label={`Bank 1 ${index + 1}`} onChange={(event) => updateLine(line.id, { bank1Amount: event.target.value })} />
                        )}
                      </td>
                      <td>{local ? <Dash /> : formatAmount(line.bank2)}</td>
                      <td>
                        {local ? (
                          <Dash />
                        ) : (
                          <input className="sheet-input sheet-input-num" value={line.freight} disabled={locked} aria-label={`Freight ${index + 1}`} onChange={(event) => updateLine(line.id, { freight: event.target.value })} />
                        )}
                      </td>
                      <td>{local ? <Dash /> : formatAmount(line.customs)}</td>
                      <td>{local ? <Dash /> : formatAmount(line.soncap)}</td>
                      <td>{sea ? formatAmount(line.shipping) : <Dash />}</td>
                      <td>{sea ? formatAmount(line.warehouseCharge) : <Dash />}</td>
                      <td>{local ? <Dash /> : formatAmount(line.agent)}</td>
                      <td>{formatAmount(line.deliveryCharge)}</td>
                      <td>
                        <input className="sheet-input sheet-input-num" value={line.deliveryOutside ?? ""} disabled={locked} aria-label={`Delivery outside Lagos ${index + 1}`} onChange={(event) => updateLine(line.id, { deliveryOutside: event.target.value })} />
                      </td>
                      <td>
                        {mode === "reviewer" ? (
                          <input className="sheet-input sheet-input-num" value={line.markup ?? ""} disabled={locked} placeholder={String(local ? rules.localMarkup : rules.markup)} aria-label={`Markup override ${index + 1}`} onChange={(event) => updateLine(line.id, { markup: event.target.value })} />
                        ) : (
                          formatAmount(line.markupAmount)
                        )}
                      </td>
                      <td>{formatAmount(line.systemCost)}</td>
                      <td>{line.rate}</td>
                      <td>{formatGrandTotal(line.unitNgn)}</td>
                      <td>{formatGrandTotal(line.extendedNgn)}</td>
                      <td>
                        <input className="sheet-input sheet-input-num" value={line.installation ?? ""} disabled={locked} aria-label={`Installation percent ${index + 1}`} onChange={(event) => updateLine(line.id, { installation: event.target.value })} />
                      </td>
                      <td>{formatAmount(line.commission)}</td>
                      <td>
                        {local ? (
                          <Dash />
                        ) : (
                          <span className="sheet-inline-fields">
                            <input type="checkbox" checked={line.applySoncap ?? false} disabled={locked} aria-label={`SONCAP applies ${index + 1}`} onChange={(event) => updateLine(line.id, { applySoncap: event.target.checked })} />
                            {line.applySoncap ? (
                              <input className="sheet-input sheet-input-num" value={line.soncapAmount ?? ""} disabled={locked} placeholder={String(rules.soncap)} aria-label={`SONCAP amount ${index + 1}`} onChange={(event) => updateLine(line.id, { soncapAmount: event.target.value })} />
                            ) : null}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="manager-sheet-actions">
          <p className="sheet-note">
            Items {summary.itemCount} · {estimateId} · {version}
          </p>
          <p className="breakdown-grand">
            <span>Grand total (NGN)</span>
            <strong>{formatGrandTotal(summary.grandTotalNgn)}</strong>
          </p>
        </div>
      </section>
    </div>
  );
}
