import type { ExchangeRateTable, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";

export const MARKUP = 0.4;

export const DEFAULT_RATES: ExchangeRateTable = {
  NGN: 1,
  USD: 1500,
  EUR: 1620,
  GBP: 1900,
};

const CHARGES: Record<SourceMode, { bank: number; duty: number | null; agency: number | null }> = {
  Local: { bank: 0.02, duty: null, agency: null },
  Air: { bank: 0.0025, duty: 0.105, agency: 0.075 },
  Sea: { bank: 0.0025, duty: 0.105, agency: 0.075 },
};

export const SONCAP_USD = 650;

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

export type ComputedLine = SheetLine & {
  bank: number;
  duties: number | null;
  agency: number | null;
  totalNgn: number;
};

export function computeLine(line: SheetLine, rates: ExchangeRateTable = DEFAULT_RATES): ComputedLine {
  const qty = parseAmount(line.qty);
  const base = parseAmount(line.base);
  const freight = parseAmount(line.freight);
  const msc = parseAmount(line.msc);
  const charge = CHARGES[line.source] ?? CHARGES.Local;
  const bank = roundMoney(base * charge.bank);
  const duties = charge.duty == null ? null : roundMoney(base * charge.duty);
  const agency = charge.agency == null ? null : roundMoney(base * charge.agency);
  const foreign = (base + freight + msc) * (1 + MARKUP) + bank + (duties ?? 0) + (agency ?? 0);
  const totalNgn = roundMoney(foreign * (rates[line.currency] ?? 1) * qty);

  return { ...line, bank, duties, agency, totalNgn };
}

export function summarizeSheet(lines: SheetLine[], rates: ExchangeRateTable = DEFAULT_RATES) {
  const computed = lines.map((line) => computeLine(line, rates));
  const named = computed.filter((line) => line.item.trim());
  const grandTotalNgn = roundMoney(computed.reduce((sum, line) => sum + line.totalNgn, 0));
  const soncapUsd = named.some((line) => line.source === "Air" || line.source === "Sea") ? SONCAP_USD : 0;

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
