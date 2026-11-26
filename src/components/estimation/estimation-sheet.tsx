"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  DEFAULT_RATES,
  formatAmount,
  formatGrandTotal,
  summarizeSheet,
} from "@/lib/estimation";
import { applySource, blankSheetLine, isLocalSource } from "@/lib/sheet-line";
import { toast } from "@/lib/toast";
import type { ExchangeRateTable, ReviewStage, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";

const RATE_FIELDS = [
  { currency: "GBP" as const, label: "GBP / NGN" },
  { currency: "EUR" as const, label: "EUR / NGN" },
  { currency: "USD" as const, label: "USD / NGN" },
  { currency: "JPY" as const, label: "JPY / NGN" },
];

const SOURCES: SourceMode[] = ["Local", "Air", "Sea"];
const CURRENCIES: SheetCurrency[] = ["NGN", "USD", "EUR", "GBP", "JPY", "OTHER"];

function Dash() {
  return <span className="manager-na">—</span>;
}

export function EstimationSheet({
  estimateId,
  version = "v1",
  mode = "originator",
  canEditRates = false,
}: {
  estimateId: string;
  version?: string;
  mode?: "originator" | "reviewer";
  canEditRates?: boolean;
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
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hint, setHint] = useState(true);
  const [pending, setPending] = useState<"save" | "submit" | "rates" | null>(null);
  const [ratesDirty, setRatesDirty] = useState(false);

  const locked = reviewStage === "in_review" || reviewStage === "approved";
  const summary = useMemo(() => summarizeSheet(lines, rates, rules), [lines, rates, rules]);
  const rulesConfigured = Object.values(rules).some((value) => value > 0);
  const missingRates = [...new Set(
    lines.filter((line) => !isLocalSource(line) && line.currency !== "NGN" && !(Number(line.exchangeRateOverride) > 0) && (line.currency === "OTHER" || !(rates[line.currency] > 0))).map((line) => line.currency),
  )];

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      estimateIdRef.current = estimateId;
      try {
        const response = await fetch(`/api/estimates/${encodeURIComponent(estimateId)}/sheet`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          lines?: SheetLine[];
          rates?: ExchangeRateTable;
          rules?: PricingRules;
          reviewStage?: ReviewStage;
        } | null;
        if (!response.ok || !payload) throw new Error(payload?.error || "Unable to load the estimation sheet.");
        if (!active) return;
        setLines(payload.lines?.length
          ? payload.lines.map((line) => ({ ...blankSheetLine(line.id, line.source), ...line }))
          : [blankSheetLine("line-1")]);
        setRates({ ...DEFAULT_RATES, ...payload.rates });
        setRules(payload.rules ?? DEFAULT_RULES);
        setReviewStage(payload.reviewStage ?? "draft");
      } catch (cause) {
        if (active) setLoadError(cause instanceof Error && cause.name === "TimeoutError"
          ? "The estimation sheet took too long to load. Try again."
          : cause instanceof Error ? cause.message : "Unable to load the estimation sheet.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [estimateId, loadAttempt]);

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
    const payload = (await response.json().catch(() => null)) as { error?: string; rates?: ExchangeRateTable } | null;
    if (!response.ok) {
      toast.error(payload?.error ?? "Unable to save exchange rates.");
      return false;
    }
    if (payload?.rates) setRates({ ...DEFAULT_RATES, ...payload.rates });
    setRatesDirty(false);
    return true;
  }

  async function saveDraft() {
    if (missingRates.length > 0) {
      toast.error(`Set an NGN exchange rate for ${missingRates.join(", ")} above before saving.`);
      return;
    }
    setPending("save");
    try {
      if (ratesDirty && !(await persistRates())) return;
      const response = await fetch(`/api/estimates/${estimateIdRef.current}/sheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; reviewStage?: ReviewStage } | null;
      if (!response.ok) {
        toast.error(payload?.error ?? "Unable to save this draft.");
        return;
      }
      if (payload?.reviewStage) setReviewStage(payload.reviewStage);
      toast.success("Draft saved");
    } catch {
      toast.error("Unable to save this draft. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  async function submit() {
    const named = lines.filter((line) => line.item.trim());
    if (named.length === 0) {
      toast.error("Add an item before submitting for review.");
      return;
    }
    setPending("submit");
    try {
      if (ratesDirty && !(await persistRates())) return;
      const saved = await fetch(`/api/estimates/${estimateIdRef.current}/sheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!saved.ok) {
        const payload = (await saved.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Unable to save this sheet.");
        return;
      }
      const submitted = await fetch(`/api/estimates/${estimateIdRef.current}/submit`, { method: "POST" });
      const payload = (await submitted.json().catch(() => null)) as { error?: string } | null;
      if (!submitted.ok) {
        toast.error(payload?.error ?? "Unable to submit this estimate.");
        return;
      }
      toast.success("Estimate submitted for review");
      router.push(`/approval?estimate=${estimateIdRef.current}`);
      router.refresh();
    } catch {
      toast.error("Unable to submit this estimate. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  if (loading || loadError) {
    return (
      <div className="page-stack">
        <h1 className="text-page-title">Estimation sheet</h1>
        {loading ? <p role="status">Loading estimation sheet…</p> : (
          <div>
            <p className="text-error" role="alert">{loadError}</p>
            <Button type="button" variant="primary" size="sm" onClick={() => setLoadAttempt((current) => current + 1)}>Try again</Button>
          </div>
        )}
      </div>
    );
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
          <button type="button" className="add-item-btn" onClick={() => void saveDraft()} disabled={locked || pending !== null || missingRates.length > 0}>
            {pending === "save" ? "Saving…" : "Save sheet"}
          </button>
        )}
      </div>

      <section className="surface-card panel-card sheet-rates-card">
        <div className="sheet-rates-head">
          <div>
            <h2 className="text-block-title">Exchange rates</h2>
            <p className="manager-note">Organization rates apply unless a line has its own exchange rate. Authorized roles can update these rates here.</p>
          </div>
          {canEditRates && !locked ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={pending !== null || !ratesDirty}
              onClick={async () => {
                setPending("rates");
                try {
                  const saved = await persistRates();
                  if (saved) toast.success("Exchange rates saved");
                } catch {
                  toast.error("Unable to save exchange rates. Check your connection and try again.");
                } finally {
                  setPending(null);
                }
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
              readOnly={locked || !canEditRates}
              onChange={(event) => {
                setRatesDirty(true);
                setRates((current) => ({ ...current, [field.currency]: Number(event.target.value) }));
              }}
            />
          ))}
        </div>
        {!canEditRates ? (
          <p className="manager-note">Only organization administrators and Sales Directors can change shared rates. Enter a line rate where a quote uses a different rate.</p>
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
      {!loading && !rulesConfigured ? <p className="text-error" role="alert">This organization has not entered pricing rules yet. Ask an administrator to set them before submitting a quotation.</p> : null}
      {missingRates.length > 0 ? (
        <p className="text-error" role="alert">
          Set an NGN exchange rate for {missingRates.join(", ")} above or on each affected line before saving or submitting.
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
                    "SONCAP per unit (FX)",
                    "Shipping line",
                    "Terminal + warehouse",
                    "Agency",
                    "Delivery (city / Lagos)",
                    "Delivery outside Lagos",
                    "Markup",
                    "Subtotal (FX)",
                    "Ex-rate",
                    "Unit (NGN)",
                    "Line subtotal (NGN)",
                    "Installation % / bonus (NGN)",
                    "Sales commission bonus (NGN)",
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
                          <input className="sheet-input sheet-input-num" value={line.markup ?? ""} disabled={locked} placeholder={String(local ? line.localType === "Purchase" ? rules.localPurchaseMarkup : rules.localMarkup : line.source === "Sea" ? rules.seaMarkup : line.freightType === "Courier" ? rules.courierMarkup : rules.markup)} aria-label={`Markup override ${index + 1}`} onChange={(event) => updateLine(line.id, { markup: event.target.value })} />
                        ) : (
                          formatAmount(line.markupAmount)
                        )}
                      </td>
                      <td>{formatAmount(line.systemCost)}</td>
                      <td>{line.rate}</td>
                      <td>{formatGrandTotal(line.unitNgn)}</td>
                      <td className="sheet-line-subtotal">{formatGrandTotal(line.extendedNgn)}</td>
                      <td>
                        <input className="sheet-input sheet-input-num" value={line.installation ?? ""} disabled={locked} aria-label={`Installation percent ${index + 1}`} onChange={(event) => updateLine(line.id, { installation: event.target.value })} />
                        <span className="sheet-computed-note">₦{formatGrandTotal(line.installationCharge)}</span>
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
        <div className="sheet-line-options">
          {summary.lines.map((line, index) => {
            const local = isLocalSource(line);
            return (
              <details key={line.id} className="sheet-line-detail">
                <summary>Item {index + 1}: {line.item || "Untitled item"} · line subtotal ₦{formatGrandTotal(line.extendedNgn)} · additional inputs</summary>
                <div className="sheet-detail-grid">
                  <label>Item number<input value={line.itemNumber ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { itemNumber: event.target.value })} /></label>
                  {local ? (
                    <label>Local layout<select value={line.localType ?? "Purchase"} disabled={locked} onChange={(event) => updateLine(line.id, { localType: event.target.value as "Purchase" | "Standard" })}><option value="Purchase">Purchase</option><option value="Standard">Standard / tax</option></select></label>
                  ) : line.source === "Air" ? (
                    <label>Air freight method<select value={line.freightType ?? "Airport"} disabled={locked || line.source !== "Air"} onChange={(event) => updateLine(line.id, { freightType: event.target.value as "Airport" | "Courier" })}><option value="Airport">Airport</option><option value="Courier">Courier</option></select></label>
                  ) : null}
                  {!local ? <label>Exchange rate for this item<input type="number" min="0" step="any" placeholder={String(rates[line.currency] || "Organization rate")} value={line.exchangeRateOverride ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { exchangeRateOverride: event.target.value })} /></label> : null}
                  {line.currency === "OTHER" ? <label>Other currency code<input maxLength={12} value={line.otherCurrencyCode ?? ""} disabled={locked} placeholder="Currency code" onChange={(event) => updateLine(line.id, { otherCurrencyCode: event.target.value })} /></label> : null}
                  {!local ? <label>Customs rate override %<input type="number" min="0" step="any" value={line.customsRate ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { customsRate: event.target.value })} /></label> : null}
                  {!local ? <label>Agency rate override %<input type="number" min="0" step="any" value={line.agencyRate ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { agencyRate: event.target.value })} /></label> : null}
                  {line.source === "Sea" ? <label>Shipping line override %<input type="number" min="0" step="any" value={line.shippingRate ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { shippingRate: event.target.value })} /></label> : null}
                  {line.source === "Sea" ? <label>Terminal and warehouse amount (FX)<input type="number" min="0" step="any" value={line.warehouse ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { warehouse: event.target.value })} /></label> : null}
                  <label>Delivery within city amount (FX or NGN)<input type="number" min="0" step="any" value={line.delivery ?? ""} disabled={locked} onChange={(event) => updateLine(line.id, { delivery: event.target.value })} /></label>
                  {local && line.localType === "Standard" ? <label className="sheet-check"><input type="checkbox" checked={line.applyVat ?? false} disabled={locked} onChange={(event) => updateLine(line.id, { applyVat: event.target.checked })} /> Apply VAT and withholding</label> : null}
                </div>
              </details>
            );
          })}
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
