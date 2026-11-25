import { DEFAULT_RULES } from "@/lib/commercial-types";
import { priceQuoteLines } from "@/lib/quote-analysis";
import type { SheetLine } from "@/lib/types";

const rates = { NGN: 1, USD: 1500, EUR: 1675, GBP: 2000, JPY: 10, OTHER: 0 };
const item: SheetLine = {
  id: "1", item: "Glassware", source: "Local", sourcing: "Local", localType: "Purchase",
  currency: "NGN", qty: "10", base: "200000", freight: "", msc: "",
};

it("starts new organizations without workbook sample percentages", () => {
  expect(Object.values(DEFAULT_RULES).every((rate) => rate === 0)).toBe(true);
});

it("calculates the local purchase unit subtotal, line subtotal, and excluded bonus", () => {
  const rules = { ...DEFAULT_RULES, localPurchaseBank: 0.35, localPurchaseDelivery: 1, localPurchaseMarkup: 25, commission: 1 };
  const [line] = priceQuoteLines([item], rates, rules);
  expect(line.bank).toBe(700);
  expect(line.deliveryCharge).toBe(2000);
  expect(line.systemCost).toBe(252700);
  expect(line.extendedNgn).toBe(2527000);
  expect(line.commission).toBe(25270);
});

it("prices air courier charges from configured rules and per-item inputs", () => {
  const rules = { ...DEFAULT_RULES, surcharge: 0.25, courierBank: 0.35, courierCustoms: 10.5, courierAgency: 4, courierDelivery: 1, courierMarkup: 25 };
  const [line] = priceQuoteLines([{ ...item, source: "Air", sourcing: "Foreign", freightType: "Courier", currency: "USD", base: "2000", freight: "360", bank1Amount: "50" }], rates, rules);
  expect(line.surcharge).toBe(5);
  expect(line.bank).toBe(50);
  expect(line.bank2).toBe(7);
  expect(line.customs).toBeCloseTo(247.8);
  expect(line.agent).toBe(80);
  expect(line.systemCost).toBeCloseTo(3359.8);
  expect(line.extendedNgn).toBe(50397000);
});

it("spreads shipment SONCAP across quantity and excludes commission and installation from cost", () => {
  const rules = { ...DEFAULT_RULES, seaSurcharge: 0.25, insurance: 1, seaBank: 0.35, seaCustoms: 24.5, shipping: 10, warehouse: 50, seaAgency: 5, seaDelivery: 1, seaMarkup: 25, commission: 1, installation: 5 };
  const [line] = priceQuoteLines([{ ...item, source: "Sea", sourcing: "Foreign", currency: "GBP", base: "100", freight: "0", bank1Amount: "2", applySoncap: true, soncapAmount: "750" }], rates, rules);
  expect(line.soncapShipment).toBe(750);
  expect(line.soncap).toBe(75);
  expect(line.warehouseCharge).toBe(5);
  expect(line.systemCost).toBeCloseTo(249.35);
  expect(line.extendedNgn).toBe(4986900);
  expect(line.installationCharge).toBe(249345);
  expect(line.commission).toBe(49869);
});

it("applies per-line exchange rates and variable delivery without changing organization rates", () => {
  const rules = { ...DEFAULT_RULES, seaDelivery: 1 };
  const [line] = priceQuoteLines([{ ...item, source: "Sea", sourcing: "Foreign", currency: "GBP", base: "100", qty: "2", exchangeRateOverride: "1800", deliveryOutside: "10", delivery: "5", warehouse: "7" }], rates, rules);
  expect(line.rate).toBe(1800);
  expect(line.deliveryCharge).toBe(5);
  expect(line.deliveryOutsideCharge).toBe(10);
  expect(line.warehouseCharge).toBe(7);
  expect(line.extendedNgn).toBe(439200);
  expect(rates.GBP).toBe(2000);
});

it("keeps local standard VAT optional and separate from the purchase layout", () => {
  const rules = { ...DEFAULT_RULES, vat: 7.5, withholding: 5 };
  const [standard, purchase] = priceQuoteLines([
    { ...item, localType: "Standard", applyVat: true, base: "1000", qty: "1" },
    { ...item, id: "2", localType: "Purchase", applyVat: true, base: "1000", qty: "1" },
  ], rates, rules);
  expect(standard.vat).toBe(75);
  expect(standard.withholding).toBe(-50);
  expect(purchase.vat).toBe(0);
  expect(purchase.withholding).toBe(0);
});

it("supports yen and a named other currency with a per-item rate", () => {
  const [yen, other] = priceQuoteLines([
    { ...item, source: "Sea", sourcing: "Foreign", currency: "JPY", base: "100", qty: "1" },
    { ...item, id: "2", source: "Sea", sourcing: "Foreign", currency: "OTHER", otherCurrencyCode: "CHF", exchangeRateOverride: "1850", base: "100", qty: "1" },
  ], rates, DEFAULT_RULES);
  expect(yen.extendedNgn).toBe(1000);
  expect(other.extendedNgn).toBe(185000);
});
