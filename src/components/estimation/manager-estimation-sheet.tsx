"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_RATES, formatAmount, formatGrandTotal } from "@/lib/estimation";
import { priceManagerLines } from "@/lib/manager-pricing";
import type { ExchangeRateTable, SheetCurrency, SheetLine, SourceMode, SourcingType } from "@/lib/types";

const SOURCES: SourceMode[] = ["Local", "Air", "Sea"];
const CURRENCIES: SheetCurrency[] = ["NGN", "USD", "EUR", "GBP"];

function blank(id: string): SheetLine {
  return {
    id,
    item: "",
    source: "Local",
    currency: "NGN",
    qty: "1",
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
    sourcing: "Local",
    delivery: "",
    warehouse: "",
    markup: "30",
  };
}

function money(value: number | null) {
  if (value == null) return "—";
  return formatAmount(value);
}

export function ManagerEstimationSheet({ estimateId }: { estimateId: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<SheetLine[]>(() => [blank("line-1")]);
  const [rates, setRates] = useState<ExchangeRateTable>(DEFAULT_RATES);
  const [hint, setHint] = useState(true);
  const [message, setMessage] = useState("");
  const priced = useMemo(() => priceManagerLines(lines, rates), [lines, rates]);
  const grand = priced.reduce((sum, line) => sum + line.extendedNgn, 0);

  useEffect(() => {
    let active = true;
    fetch(`/api/estimates/${estimateId}/sheet`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { lines?: SheetLine[]; rates?: ExchangeRateTable } | null) => {
        if (!active || !payload) return;
        if (payload.rates) setRates(payload.rates);
        if (payload.lines && payload.lines.length > 0) {
          setLines(payload.lines.map((line) => ({ ...blank(line.id), ...line, sourcing: line.sourcing ?? (line.source === "Local" ? "Local" : "Foreign") })));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [estimateId]);

  function patch(id: string, next: Partial<SheetLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const merged = { ...line, ...next };
        if (next.sourcing === "Local") {
          merged.source = "Local";
          merged.currency = "NGN";
        }
        if (next.sourcing === "Foreign" && merged.source === "Local") merged.source = "Air";
        if (next.source === "Local") merged.sourcing = "Local";
        return merged;
      }),
    );
  }

  async function save() {
    setMessage("");
    const response = await fetch(`/api/estimates/${estimateId}/sheet`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const payload = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Sheet saved." : payload.error ?? "Unable to save this sheet.");
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">Estimation sheet</h1>
        <button type="button" className="add-item-btn" onClick={() => void save()}>
          Save sheet
        </button>
      </div>
      <p className="manager-note">
        Local items skip foreign charges. Swipe the sheet sideways for manufacturer, freight, and the NGN totals.
      </p>
      {message ? <p className="sheet-message">{message}</p> : null}

      <section className="surface-card panel-card manager-sheet">
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
            <table className="data-table manager-table">
              <thead>
                <tr>
                  {[
                    "#",
                    "Item description",
                    "Manufacturer",
                    "Model",
                    "Part number",
                    "Technical specification",
                    "Qty",
                    "UOM",
                    "Supplier",
                    "Sourcing",
                    "Freight method",
                    "Base price",
                    "Currency",
                    "Bank",
                    "Freight",
                    "Customs",
                    "Agent fee",
                    "Delivery",
                    "Warehouse",
                    "SONCAP",
                    "Markup",
                    "Misc",
                    "System cost",
                    "Rate",
                    "Unit (NGN)",
                    "Extended (NGN)",
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priced.map((line, index) => {
                  const local = line.sourcing !== "Foreign";
                  return (
                    <tr key={line.id}>
                      <td className="sticky-col">{index + 1}</td>
                      <td className="sticky-col sticky-second">
                        <input className="sheet-input sheet-input-item" value={line.item} aria-label={`Description ${index + 1}`} onChange={(event) => patch(line.id, { item: event.target.value })} />
                      </td>
                      <td><input className="sheet-input" value={line.manufacturer ?? ""} aria-label={`Manufacturer ${index + 1}`} onChange={(event) => patch(line.id, { manufacturer: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.model ?? ""} aria-label={`Model ${index + 1}`} onChange={(event) => patch(line.id, { model: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.partNumber ?? ""} aria-label={`Part number ${index + 1}`} onChange={(event) => patch(line.id, { partNumber: event.target.value })} /></td>
                      <td><input className="sheet-input sheet-input-item" value={line.specification ?? ""} aria-label={`Specification ${index + 1}`} onChange={(event) => patch(line.id, { specification: event.target.value })} /></td>
                      <td><input className="sheet-input sheet-input-num" value={line.qty} aria-label={`Quantity ${index + 1}`} onChange={(event) => patch(line.id, { qty: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.unit ?? ""} aria-label={`Unit ${index + 1}`} onChange={(event) => patch(line.id, { unit: event.target.value })} /></td>
                      <td><input className="sheet-input" value={line.supplier ?? ""} aria-label={`Supplier ${index + 1}`} onChange={(event) => patch(line.id, { supplier: event.target.value })} /></td>
                      <td>
                        <select className="sheet-select" value={line.sourcing ?? "Local"} aria-label={`Sourcing ${index + 1}`} onChange={(event) => patch(line.id, { sourcing: event.target.value as SourcingType })}>
                          <option>Local</option>
                          <option>Foreign</option>
                        </select>
                      </td>
                      <td>
                        {local ? (
                          <span className="manager-na">—</span>
                        ) : (
                          <select className="sheet-select" value={line.source === "Sea" ? "Sea" : "Air"} aria-label={`Freight method ${index + 1}`} onChange={(event) => patch(line.id, { source: event.target.value as SourceMode })}>
                            {SOURCES.filter((source) => source !== "Local").map((source) => (
                              <option key={source}>{source}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td><input className="sheet-input sheet-input-num" value={line.base} aria-label={`Base price ${index + 1}`} onChange={(event) => patch(line.id, { base: event.target.value })} /></td>
                      <td>
                        <select className="sheet-select" value={local ? "NGN" : line.currency} disabled={local} aria-label={`Currency ${index + 1}`} onChange={(event) => patch(line.id, { currency: event.target.value as SheetCurrency })}>
                          {CURRENCIES.map((currency) => (
                            <option key={currency}>{currency}</option>
                          ))}
                        </select>
                      </td>
                      <td>{formatAmount(line.bank)}</td>
                      <td>{local ? "—" : formatAmount(parseFloat(line.freight || "0") || 0)}</td>
                      <td>{money(line.customs)}</td>
                      <td>{money(line.agent)}</td>
                      <td>{money(line.deliveryCharge)}</td>
                      <td>{money(line.warehouseCharge)}</td>
                      <td>{money(line.soncap)}</td>
                      <td>{formatAmount(line.markupAmount)}</td>
                      <td><input className="sheet-input sheet-input-num" value={line.msc} aria-label={`Miscellaneous ${index + 1}`} onChange={(event) => patch(line.id, { msc: event.target.value })} /></td>
                      <td>{formatAmount(line.systemCost)}</td>
                      <td>{line.rate}</td>
                      <td>{formatGrandTotal(line.unitNgn)}</td>
                      <td>{formatGrandTotal(line.extendedNgn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="manager-sheet-actions">
          <button
            type="button"
            className="add-item-btn"
            onClick={() => setLines((current) => [...current, blank(`line-${current.length + 1}`)])}
          >
            <span aria-hidden>•</span> Add item
          </button>
          <p className="breakdown-grand">
            <span>Extended total (NGN)</span>
            <strong>{formatGrandTotal(grand)}</strong>
          </p>
        </div>
      </section>
    </div>
  );
}
