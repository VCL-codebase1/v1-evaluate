const parseAmount = (value: string) => Number(value.replace(/,/g, "").trim()) || 0;
const roundMoney = (value: number) => Math.round(value * 100) / 100;
import type { PricingRules } from "@/lib/commercial-types";
import type { ExchangeRateTable, SheetLine } from "@/lib/types";

export type QuoteLine = SheetLine & {
  surcharge: number;
  insurance: number;
  bank: number;
  bank2: number;
  customs: number;
  agent: number;
  shipping: number;
  warehouseCharge: number;
  deliveryCharge: number;
  installationCharge: number;
  vat: number;
  withholding: number;
  commission: number;
  soncap: number;
  markupAmount: number;
  systemCost: number;
  rate: number;
  unitNgn: number;
  extendedNgn: number;
};

export function priceQuoteLines(lines: SheetLine[], rates: ExchangeRateTable, rules: PricingRules): QuoteLine[] {
  return lines.map((line) => {
    const base = parseAmount(line.base);
    const other = parseAmount(line.msc);
    const qty = parseAmount(line.qty);
    const method = line.source;
    const local = method === "Local" || line.sourcing === "Local";
    const localPurchase = local && line.localType === "Purchase";
    const freight = local ? 0 : parseAmount(line.freight);
    const sea = !local && method === "Sea";
    const courier = !local && method === "Air" && line.freightType === "Courier";
    const percent = (amount: number, rate: number) => amount * rate / 100;
    const surcharge = local || courier ? 0 : percent(base, rules.surcharge);
    const insurance = sea ? percent(base, rules.insurance) : 0;
    const bank = local ? 0 : line.bank1Amount?.trim() ? parseAmount(line.bank1Amount) : percent(base, rules.bank1);
    const bank2 = localPurchase ? percent(base + other, rules.localPurchaseBank) : percent(base, local ? rules.localBank : courier ? rules.courierBank : rules.airBank);
    const customs = local ? 0 : percent(base + freight + insurance, line.customsRate?.trim() ? parseAmount(line.customsRate) : courier ? rules.courierCustoms : sea ? rules.seaCustoms : rules.customs);
    const agent = local ? 0 : percent(courier ? customs : base, line.agencyRate?.trim() ? parseAmount(line.agencyRate) : courier ? rules.courierAgency : sea ? rules.seaAgency : rules.agency);
    const shipping = sea ? percent(base, line.shippingRate?.trim() ? parseAmount(line.shippingRate) : rules.shipping) : 0;
    const warehouseCharge = sea ? shipping : 0;
    const deliveryCharge = line.delivery?.trim() ? parseAmount(line.delivery) : percent(base, localPurchase ? rules.localPurchaseDelivery : local ? rules.localDelivery : courier ? rules.courierDelivery : sea ? rules.seaDelivery : rules.delivery);
    const installationCharge = line.installation?.trim() ? parseAmount(line.installation) : percent(base, local ? rules.localInstallation : rules.installation);
    const vat = local && !localPurchase && line.applyVat ? percent(base, rules.vat) : 0;
    const withholding = local && !localPurchase && line.applyVat ? -percent(base, rules.withholding) : 0;
    const commission = localPurchase || courier || sea ? percent(base, rules.commission) : 0;
    const soncap = !local && line.applySoncap ? line.soncapAmount?.trim() ? parseAmount(line.soncapAmount) : rules.soncap : 0;
    const markupRate = line.markup?.trim() ? parseAmount(line.markup) : localPurchase ? rules.localPurchaseMarkup : local ? rules.localMarkup : courier ? rules.courierMarkup : rules.markup;
    const markupAmount = percent(base + (local || courier ? 0 : freight), markupRate);
    const rawCost = base + other + surcharge + insurance + bank + bank2 + freight + customs + agent + shipping + warehouseCharge + deliveryCharge + installationCharge + vat + withholding + commission + soncap + markupAmount;
    const systemCost = roundMoney(rawCost);
    const rate = local ? 1 : rates[line.currency] ?? 0;
    const unitNgn = roundMoney(rawCost * rate);
    return { ...line, surcharge, insurance, bank, bank2, customs, agent, shipping, warehouseCharge, deliveryCharge, installationCharge, vat, withholding, commission, soncap, markupAmount, systemCost, rate, unitNgn, extendedNgn: roundMoney(rawCost * rate * qty) };
  });
}
