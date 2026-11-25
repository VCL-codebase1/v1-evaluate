import type { ExchangeRateTable, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";
import { DEFAULT_RULES, type PricingRules } from "@/lib/commercial-types";
import { priceQuoteLines } from "@/lib/quote-analysis";

export const DEFAULT_RATES: ExchangeRateTable = {
  NGN: 1,
  USD: 0,
  EUR: 0,
  GBP: 0,
  JPY: 0,
  OTHER: 0,
};

export function currencyFor(source: SourceMode): SheetCurrency {
  if (source === "Air") return "USD";
  if (source === "Sea") return "GBP";
  return "NGN";
}

export function parseAmount(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function summarizeSheet(lines: SheetLine[], rates: ExchangeRateTable = DEFAULT_RATES, rules: PricingRules = DEFAULT_RULES) {
  const computed = priceQuoteLines(lines, rates, rules).map((line) => ({ ...line, duties: line.customs, agency: line.agent, totalNgn: line.extendedNgn }));
  const named = computed.filter((line) => line.item.trim());
  const grandTotalNgn = roundMoney(computed.reduce((sum, line) => sum + line.totalNgn, 0));
  const soncapUsd = named.reduce((sum, line) => sum + line.soncapShipment, 0);

  return {
    lines: computed,
    itemCount: named.length,
    grandTotalNgn,
    soncapUsd,
  };
}

export function formatAmount(value: number | null) {
  if (value == null) return "N/A";
  if (value === 0) return "0.0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatGrandTotal(value: number) {
  if (value === 0) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSoncap(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
