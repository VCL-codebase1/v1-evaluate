import { parseAmount, roundMoney } from "@/lib/estimation";
import type { ExchangeRateTable, SheetLine } from "@/lib/types";

export type ManagerLine = SheetLine & {
  bank: number;
  customs: number | null;
  agent: number | null;
  deliveryCharge: number | null;
  warehouseCharge: number | null;
  soncap: number | null;
  markupAmount: number;
  systemCost: number;
  rate: number;
  unitNgn: number;
  extendedNgn: number;
};

export function priceManagerLines(lines: SheetLine[], rates: ExchangeRateTable): ManagerLine[] {
  const seaCount = lines.filter((line) => (line.sourcing ?? "Local") === "Foreign" && line.source === "Sea").length;

  return lines.map((line) => {
    const local = (line.sourcing ?? "Local") !== "Foreign";
    const qty = parseAmount(line.qty) || 0;
    const base = parseAmount(line.base);
    const freight = local ? 0 : parseAmount(line.freight);
    const misc = parseAmount(line.msc);
    const bank = roundMoney(base * (local ? 0.02 : 0.0025));
    const customs = local ? null : roundMoney((base + freight) * 0.105);
    const agent = local ? null : roundMoney(base * 0.075);
    const deliveryCharge = local ? null : roundMoney(base * 0.015);
    const warehouseCharge = local || line.source !== "Sea" ? null : roundMoney(base * 0.125);
    const soncapShare = !local && line.source === "Sea" && seaCount > 0 ? 650 / seaCount : 0;
    const soncap = local || line.source !== "Sea" ? null : roundMoney(soncapShare);
    const markupInput = parseAmount(line.markup ?? "");
    const markupRate = markupInput > 0 ? markupInput / 100 : 0.3;
    const markupAmount = roundMoney((base + freight) * markupRate);
    const systemCost = roundMoney(
      base +
        bank +
        freight +
        (customs ?? 0) +
        (agent ?? 0) +
        (deliveryCharge ?? 0) +
        (warehouseCharge ?? 0) +
        (soncap ?? 0) +
        markupAmount +
        misc,
    );
    const rate = local ? 1 : rates[line.currency] ?? 1;
    const unitNgn = roundMoney(systemCost * rate);
    const extendedNgn = roundMoney(unitNgn * (qty || 0));
    return {
      ...line,
      bank,
      customs,
      agent,
      deliveryCharge,
      warehouseCharge,
      soncap,
      markupAmount,
      systemCost,
      rate,
      unitNgn,
      extendedNgn,
    };
  });
}
