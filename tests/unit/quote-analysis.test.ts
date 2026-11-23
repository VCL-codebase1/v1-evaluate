import { DEFAULT_RULES } from "@/lib/commercial-types";
import { priceQuoteLines } from "@/lib/quote-analysis";
import type { SheetLine } from "@/lib/types";

const rates = { NGN: 1, USD: 365, EUR: 425, GBP: 485 };
const item: SheetLine = { id: "1", item: "Glassware", source: "Air", sourcing: "Foreign", freightType: "Courier", currency: "USD", qty: "2", base: "2000", freight: "360", msc: "0", bank1Amount: "50" };

it("uses courier rules and per item charges to produce a NGN extended price", () => {
  const [line] = priceQuoteLines([item], rates, DEFAULT_RULES);
  expect(line.bank).toBe(50);
  expect(line.bank2).toBe(20);
  expect(line.customs).toBe(188.8);
  expect(line.agent).toBe(18.88);
  expect(line.systemCost).toBe(3167.68);
  expect(line.extendedNgn).toBe(2312406.4);
  expect(priceQuoteLines([{ ...item, applySoncap: true, soncapAmount: "650" }], rates, DEFAULT_RULES)[0].soncap).toBe(650);
  expect(priceQuoteLines([{ ...item, applySoncap: true }], rates, DEFAULT_RULES)[0].soncap).toBe(0);
});

it("uses local VAT only when selected and avoids foreign charges", () => {
  const [line] = priceQuoteLines([{ ...item, source: "Local", sourcing: "Local", currency: "NGN", applyVat: true }], rates, DEFAULT_RULES);
  expect(line.customs).toBe(0);
  expect(line.freight).toBe("360");
  expect(line.vat).toBe(150);
  expect(line.withholding).toBe(-100);
  expect(line.rate).toBe(1);
});

it("matches the local purchase example in the workbook", () => {
  const [line] = priceQuoteLines([{ ...item, source: "Local", sourcing: "Local", localType: "Purchase", currency: "NGN", base: "100000", freight: "0", bank1Amount: "" }], rates, DEFAULT_RULES);
  expect(line.systemCost).toBe(123000);
  expect(line.extendedNgn).toBe(246000);
});

it("matches airport and sea formula components", () => {
  const airport = priceQuoteLines([{ ...item, freightType: "Airport", base: "100", freight: "20", bank1Amount: "" }], rates, DEFAULT_RULES)[0];
  expect(airport.surcharge).toBe(1);
  expect(airport.bank2).toBe(0.35);
  expect(airport.customs).toBe(12.6);
  expect(airport.agent).toBe(5);
  expect(airport.markupAmount).toBe(30);

  const sea = priceQuoteLines([{ ...item, source: "Sea", base: "100", freight: "20", bank1Amount: "" }], rates, DEFAULT_RULES)[0];
  expect(sea.insurance).toBe(1);
  expect(sea.customs).toBe(24.2);
  expect(sea.shipping).toBe(10);
  expect(sea.warehouseCharge).toBe(10);
  expect(sea.markupAmount).toBe(30);
});
