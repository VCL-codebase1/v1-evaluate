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
import { SHEET_NOTES, SHEET_TABS, UNIFIED_COLUMNS, columnActive, type SheetColId } from "@/lib/sheet-columns";
import { applySource, blankSheetLine, isLocalSource } from "@/lib/sheet-line";
import { toast } from "@/lib/toast";
import type { QuoteLine } from "@/lib/quote-analysis";
import type { ExchangeRateTable, ReviewStage, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";

const RATE_FIELDS = [
  { currency: "GBP" as const, label: "GBP / NGN" },
  { currency: "EUR" as const, label: "EUR / NGN" },
  { currency: "USD" as const, label: "USD / NGN" },
  { currency: "JPY" as const, label: "JPY / NGN" },
];

const FOREIGN_CURRENCIES: SheetCurrency[] = ["USD", "EUR", "GBP", "JPY", "OTHER"];

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
        const nextLines = payload.lines?.length
          ? payload.lines.map((line) => ({ ...blankSheetLine(line.id, line.source), ...line }))
          : [blankSheetLine("line-1")];
        setLines(nextLines);
        setSetAll(nextLines[0]?.source ?? "Local");
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
      toast.success("Draft saved", { persist: true });
      router.push(`/approval?estimate=${encodeURIComponent(estimateIdRef.current)}`);
      router.refresh();
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
      toast.success("Estimate submitted for review", { persist: true });
      router.push(`/approval?estimate=${encodeURIComponent(estimateIdRef.current)}`);
      router.refresh();
    } catch {
      toast.error("Unable to submit this estimate. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  function numInput(line: QuoteLine, index: number, field: keyof SheetLine, label: string, inactive = false) {
    return (
      <input
        className={inactive ? "sheet-input sheet-input-num is-inactive" : "sheet-input sheet-input-num"}
        value={inactive ? "" : ((line[field] as string | undefined) ?? "")}
        disabled={locked || inactive}
        aria-label={`${label} ${index + 1}`}
        onChange={(event) => updateLine(line.id, { [field]: event.target.value } as Partial<SheetLine>)}
      />
    );
  }

  function renderCell(col: SheetColId, line: QuoteLine, index: number) {
    const local = setAll === "Local";
    const inactive = !columnActive(col, setAll);
    switch (col) {
      case "sn":
        return <span className="sheet-index">{index + 1}</span>;
      case "currency":
        if (local) return <span className="sheet-currency-locked">NGN</span>;
        return (
          <select
            className={inactive ? "sheet-select is-inactive" : "sheet-select"}
            value={line.currency}
            disabled={locked || inactive}
            aria-label={`Currency ${index + 1}`}
            onChange={(event) => updateLine(line.id, { currency: event.target.value as SheetCurrency })}
          >
            {FOREIGN_CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        );
      case "item":
        return (
          <input
            className="sheet-input sheet-input-item"
            value={line.item}
            disabled={locked}
            aria-label={`Item ${index + 1}`}
            onChange={(event) => updateLine(line.id, { item: event.target.value })}
          />
        );
      case "qty":
        return numInput(line, index, "qty", "Qty", inactive);
      case "base":
        return numInput(line, index, "base", "Base price", inactive);
      case "other":
        return numInput(line, index, "msc", "Other charges", inactive);
      case "bank1":
        if (inactive) return <span className="sheet-inactive">—</span>;
        return local ? formatAmount(line.bank) : numInput(line, index, "bank1Amount", "Bank 1");
      case "deliveryCity":
      case "delivery":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.deliveryCharge);
      case "deliveryOutside":
        return numInput(line, index, "deliveryOutside", "Delivery outside Lagos", inactive);
      case "markup":
        if (inactive) return <span className="sheet-inactive">—</span>;
        if (mode === "reviewer") {
          return numInput(line, index, "markup", "Markup %");
        }
        return formatAmount(line.markupAmount);
      case "totalNgn":
      case "subNgn":
        return inactive ? <span className="sheet-inactive">—</span> : formatGrandTotal(line.unitNgn);
      case "commission":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.commission);
      case "installation":
        if (inactive) return <span className="sheet-inactive">—</span>;
        return (
          <span className="sheet-inline-fields">
            {numInput(line, index, "installation", "Installation %")}
            <span className="sheet-computed-note">₦{formatGrandTotal(line.installationCharge)}</span>
          </span>
        );
      case "grand":
        return formatGrandTotal(line.extendedNgn);
      case "surcharge":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.surcharge);
      case "insurance":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.insurance);
      case "bank2":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.bank2);
      case "freight":
        return numInput(line, index, "freight", "Freight", inactive);
      case "customs":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.customs);
      case "soncap":
        if (inactive) return <span className="sheet-inactive">—</span>;
        return (
          <span className="sheet-inline-fields">
            <input
              type="checkbox"
              checked={line.applySoncap ?? false}
              disabled={locked}
              aria-label={`SONCAP applies ${index + 1}`}
              onChange={(event) => updateLine(line.id, { applySoncap: event.target.checked })}
            />
            {line.applySoncap ? numInput(line, index, "soncapAmount", "SONCAP amount") : <Dash />}
          </span>
        );
      case "agency":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.agent);
      case "shipping":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.shipping);
      case "warehouse":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.warehouseCharge);
      case "subFx":
        return inactive ? <span className="sheet-inactive">—</span> : formatAmount(line.systemCost);
      case "exRate":
        return (
          <input
            className={inactive ? "sheet-input sheet-input-num is-inactive" : "sheet-input sheet-input-num"}
            type="number"
            min="0"
            step="any"
            placeholder={inactive ? "" : String(rates[line.currency] || "")}
            value={inactive ? "" : (line.exchangeRateOverride ?? "")}
            disabled={locked || inactive}
            aria-label={`Exchange rate ${index + 1}`}
            onChange={(event) => updateLine(line.id, { exchangeRateOverride: event.target.value })}
          />
        );
      default:
        return <Dash />;
    }
  }

  const columns = UNIFIED_COLUMNS;

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
      {reviewStage === "returned" ? (
        <p className="text-error" role="status">This estimate was returned. Correct the sheet and send it for review again.</p>
      ) : null}

      <section className="surface-card panel-card sheet-rates-card">
        <div className="sheet-rates-head">
          <div>
            <h2 className="text-block-title">Exchange rates</h2>
            <p className="manager-note">Organization rates apply unless a line has its own exchange rate. Sales reps and line managers can update these rates here.</p>
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
          <p className="manager-note">Shared rates can be edited by sales reps, line managers, and directors. Enter a line rate where a quote uses a different rate.</p>
        ) : null}
      </section>

      <div className="sheet-toolbar">
        <div className="set-all">
          <span>Set all:</span>
          {SHEET_TABS.map((tab) => (
            <button
              key={tab.source}
              type="button"
              className={tab.source === setAll ? "mode-chip is-selected" : "mode-chip"}
              onClick={() => applySetAll(tab.source)}
              disabled={locked}
            >
              {tab.label}
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

      <p className="manager-note">{SHEET_NOTES[setAll]}</p>
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
                  {columns.map((column) => (
                    <th key={column.id} scope="col" className={columnActive(column.id, setAll) ? undefined : "is-inactive"}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line, index) => (
                  <tr key={line.id}>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={[
                          column.id === "sn" ? "sticky-col sheet-index" : "",
                          column.id === "item" ? "sticky-col sticky-second" : "",
                          column.id === "grand" ? "sheet-line-subtotal" : "",
                          columnActive(column.id, setAll) ? "" : "is-inactive",
                        ].filter(Boolean).join(" ") || undefined}
                      >
                        {renderCell(column.id, line, index)}
                      </td>
                    ))}
                  </tr>
                ))}
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
