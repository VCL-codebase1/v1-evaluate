"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  currencyFor,
  DEFAULT_RATES,
  formatAmount,
  formatGrandTotal,
  formatSoncap,
  summarizeSheet,
} from "@/lib/estimation";
import type { ExchangeRateTable, ReviewStage, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";

type SetAll = "Local" | "Air" | "Freight";

const SET_ALL: SetAll[] = ["Local", "Air", "Freight"];
const SOURCES: SourceMode[] = ["Local", "Air", "Sea"];
const CURRENCIES: SheetCurrency[] = ["NGN", "USD", "EUR", "GBP"];

function sourceFromSet(value: SetAll): SourceMode {
  return value === "Freight" ? "Sea" : value;
}

function blankLine(source: SourceMode, id = "draft"): SheetLine {
  return {
    id,
    item: "",
    source,
    currency: currencyFor(source),
    qty: "",
    base: "",
    freight: "",
    msc: "",
    itemNumber: "",
    manufacturer: "",
    model: "",
    partNumber: "",
    specification: "",
    unit: "",
    supplier: "",
    delivery: "",
    warehouse: "",
    markup: "",
  };
}

export function EstimationSheet({
  estimateId,
  version,
}: {
  estimateId: string;
  version: string;
}) {
  const router = useRouter();
  const estimateIdRef = useRef(estimateId);
  const [lines, setLines] = useState<SheetLine[]>([]);
  const [draft, setDraft] = useState<SheetLine>(() => blankLine("Local"));
  const [setAll, setSetAll] = useState<SetAll>("Local");
  const [rates, setRates] = useState<ExchangeRateTable>(DEFAULT_RATES);
  const [rules, setRules] = useState<PricingRules>(DEFAULT_RULES);
  const [reviewStage, setReviewStage] = useState<ReviewStage>("draft");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"save" | "submit" | null>(null);
  const [message, setMessage] = useState("");

  const locked = reviewStage === "in_review" || reviewStage === "approved";
  const visible = lines.length > 0 ? lines : [draft];
  const summary = useMemo(
    () => summarizeSheet(lines.length > 0 ? lines : [draft], rates, rules),
    [lines, draft, rates, rules],
  );
  const missingRates = [...new Set(
    (lines.length > 0 ? lines : [draft])
      .filter((line) => line.currency !== "NGN" && rates[line.currency] <= 0)
      .map((line) => line.currency),
  )];

  useEffect(() => {
    let active = true;
    async function load() {
      const sessionResponse = await fetch("/api/auth/session");
      const sessionPayload = sessionResponse.ok
        ? ((await sessionResponse.json()) as { user?: { estimateId?: string } })
        : null;
      const id = sessionPayload?.user?.estimateId || estimateId;
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
      setLines(payload.lines ?? []);
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

  function applySetAll(next: SetAll) {
    const source = sourceFromSet(next);
    const currency = currencyFor(source);
    setSetAll(next);
    setLines((current) => current.map((line) => ({ ...line, source, currency })));
    setDraft((current) => ({ ...current, source, currency }));
  }

  function updateLine(id: string, patch: Partial<SheetLine>) {
    const write = (line: SheetLine) => {
      if (line.id !== id) return line;
      const next = { ...line, ...patch };
      if (patch.source) next.currency = currencyFor(patch.source);
      return next;
    };
    if (lines.length === 0) setDraft(write);
    else setLines((current) => current.map(write));
  }

  function addItem() {
    const source = sourceFromSet(setAll);
    if (lines.length === 0) {
      setLines([{ ...draft, id: crypto.randomUUID() }]);
      setDraft(blankLine(source, crypto.randomUUID()));
      return;
    }
    setLines((current) => [...current, blankLine(source, crypto.randomUUID())]);
  }

  async function saveDraft() {
    setMessage("");
    setPending("save");
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
    const named = (lines.length > 0 ? lines : [draft]).filter((line) => line.item.trim());
    if (named.length === 0) {
      setMessage("Add an item before submitting for review.");
      return;
    }
    const payloadLines = lines.length > 0 ? lines : [{ ...draft }];
    setPending("submit");
    const saved = await fetch(`/api/estimates/${estimateIdRef.current}/sheet`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: payloadLines }),
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
        <Button type="button" variant="primary" size="sm" onClick={submit} disabled={locked || pending !== null || missingRates.length > 0}>
          {locked ? "Submitted for review" : pending === "submit" ? "Submitting…" : "Submit for review"}
        </Button>
      </div>

      <div className="sheet-toolbar">
        <div className="set-all">
          <span>Set all:</span>
          {SET_ALL.map((option) => (
            <button
              key={option}
              type="button"
              className={option === setAll ? "mode-chip is-selected" : "mode-chip"}
              onClick={() => applySetAll(option)}
              disabled={locked}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <Button type="button" variant="primary" size="sm" onClick={addItem} disabled={locked}>
            + Add item
          </Button>
          {lines.length > 0 ? (
            <Button type="button" variant="quiet" size="sm" onClick={saveDraft} disabled={locked || pending !== null || missingRates.length > 0}>
              {pending === "save" ? "Saving…" : "Save draft"}
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <p className="sheet-message">{message}</p> : null}
      {missingRates.length > 0 ? (
        <p className="text-error" role="alert">
          Set an NGN exchange rate for {missingRates.join(", ")} in <a className="text-link" href="/exchange-rates">Exchange rates</a> before saving or submitting.
        </p>
      ) : null}

      <section className="surface-card panel-card sheet-card" aria-busy={loading}>
        <div className="table-scroll">
          <table className="data-table sheet-table">
            <thead>
              <tr>
                {["#", "Item no.", "Item", "Manufacturer", "Model", "Part no.", "Specification", "Unit", "Supplier", "Source", "Currency", "Qty", "Base", "Freight", "Msc", "Delivery", "Warehouse", "Markup", "Bank", "Duties", "Agency", "Delivered"].map(
                  (heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((line, index) => {
                const computed = summarizeSheet([line], rates, rules).lines[0];
                return (
                  <tr key={line.id}>
                    <td className="sheet-index">{lines.length === 0 ? "#" : index + 1}</td>
                    {(
                      [
                        ["itemNumber", "Item number"],
                      ] as const
                    ).map(([field, label]) => (
                      <td key={field}>
                        <input
                          className="sheet-input"
                          aria-label={`${label} ${index + 1}`}
                          value={line[field] ?? ""}
                          disabled={locked}
                          onChange={(event) => updateLine(line.id, { [field]: event.target.value })}
                        />
                      </td>
                    ))}
                    <td>
                      <input
                        className="sheet-input sheet-input-item"
                        aria-label={`Item ${index + 1}`}
                        value={line.item}
                        disabled={locked}
                        onChange={(event) => updateLine(line.id, { item: event.target.value })}
                      />
                    </td>
                    {(
                      [
                        ["manufacturer", "Manufacturer"],
                        ["model", "Model"],
                        ["partNumber", "Part number"],
                        ["specification", "Specification"],
                        ["unit", "Unit"],
                        ["supplier", "Supplier"],
                      ] as const
                    ).map(([field, label]) => (
                      <td key={field}>
                        <input
                          className="sheet-input"
                          aria-label={`${label} ${index + 1}`}
                          value={line[field] ?? ""}
                          disabled={locked}
                          onChange={(event) => updateLine(line.id, { [field]: event.target.value })}
                        />
                      </td>
                    ))}
                    <td>
                      <select
                        className="sheet-select"
                        aria-label={`Source ${index + 1}`}
                        value={line.source}
                        disabled={locked}
                        onChange={(event) => updateLine(line.id, { source: event.target.value as SourceMode })}
                      >
                        {SOURCES.map((source) => (
                          <option key={source}>{source}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="sheet-select"
                        aria-label={`Currency ${index + 1}`}
                        value={line.currency}
                        disabled={locked}
                        onChange={(event) => updateLine(line.id, { currency: event.target.value as SheetCurrency })}
                      >
                        {CURRENCIES.map((currency) => (
                          <option key={currency}>{currency}</option>
                        ))}
                      </select>
                    </td>
                    {(["qty", "base", "freight", "msc"] as const).map((field) => (
                      <td key={field}>
                        <input
                          className="sheet-input sheet-input-num"
                          aria-label={`${field} ${index + 1}`}
                          inputMode="decimal"
                          value={
                            locked
                              ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
                                  Number(line[field] || 0),
                                )
                              : line[field]
                          }
                          disabled={locked}
                          onChange={(event) => updateLine(line.id, { [field]: event.target.value })}
                        />
                      </td>
                    ))}
                    {(
                      [
                        ["delivery", "Delivery"],
                        ["warehouse", "Warehouse"],
                        ["markup", "Markup"],
                      ] as const
                    ).map(([field, label]) => (
                      <td key={field}>
                        <input
                          className="sheet-input sheet-input-num"
                          aria-label={`${label} ${index + 1}`}
                          value={line[field] ?? ""}
                          disabled={locked}
                          onChange={(event) => updateLine(line.id, { [field]: event.target.value })}
                        />
                      </td>
                    ))}
                    <td className="sheet-calc">{formatAmount(computed.bank)}</td>
                    <td className="sheet-calc">{formatAmount(computed.duties)}</td>
                    <td className="sheet-calc">{formatAmount(computed.agency)}</td>
                    <td className="sheet-calc">{formatAmount(computed.totalNgn)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card panel-card sheet-total">
        <p className="sheet-note">
          Items {summary.itemCount} · SONCAP allocated USD {formatSoncap(summary.soncapUsd)} · Locked when approved
        </p>
        <div className="sheet-grand">
          <p className="sheet-grand-label">Grand total (NGN)</p>
          <p className="sheet-grand-value">{formatGrandTotal(summary.grandTotalNgn)}</p>
        </div>
      </section>
      <p className="sheet-version">
        {estimateId} · {version}
      </p>
    </div>
  );
}
