import type { SheetCurrency } from "@/lib/types";

export type ForeignCurrency = Exclude<SheetCurrency, "NGN" | "OTHER">;

const FOREIGN: ForeignCurrency[] = ["USD", "EUR", "GBP", "JPY"];

export type LiveNgnRates = Record<ForeignCurrency, number | null>;

/** NGN per 1 unit of each foreign currency, from a public mid-market feed. */
export async function fetchLiveNgnRates(): Promise<LiveNgnRates> {
  const empty: LiveNgnRates = { USD: null, EUR: null, GBP: null, JPY: null };
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/NGN", {
      next: { revalidate: 60 * 30 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return empty;
    const payload = (await response.json()) as { result?: string; rates?: Record<string, number> };
    if (payload.result !== "success" || !payload.rates) return empty;
    const live = { ...empty };
    for (const currency of FOREIGN) {
      const perNgn = payload.rates[currency];
      if (typeof perNgn === "number" && perNgn > 0) {
        live[currency] = Math.round((1 / perNgn) * 100) / 100;
      }
    }
    return live;
  } catch {
    return empty;
  }
}
