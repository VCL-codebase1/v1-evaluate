import type { SourceMode } from "@/lib/types";

export const SHEET_TABS: { source: SourceMode; label: string }[] = [
  { source: "Local", label: "Local" },
  { source: "Air", label: "Air" },
  { source: "Sea", label: "Freight" },
];

export type SheetColId =
  | "sn"
  | "currency"
  | "item"
  | "qty"
  | "base"
  | "other"
  | "bank1"
  | "deliveryCity"
  | "deliveryOutside"
  | "markup"
  | "totalNgn"
  | "commission"
  | "installation"
  | "grand"
  | "surcharge"
  | "insurance"
  | "bank2"
  | "freight"
  | "customs"
  | "soncap"
  | "agency"
  | "shipping"
  | "warehouse"
  | "delivery"
  | "subFx"
  | "exRate"
  | "subNgn";

export const SHEET_COLUMNS: Record<SourceMode, { id: SheetColId; label: string }[]> = {
  Local: [
    { id: "sn", label: "S/N" },
    { id: "currency", label: "Currency" },
    { id: "item", label: "Item description" },
    { id: "base", label: "Base price (NGN)" },
    { id: "other", label: "Other charges" },
    { id: "bank1", label: "Bank 1" },
    { id: "deliveryCity", label: "Delivery within city" },
    { id: "deliveryOutside", label: "Delivery outside Lagos" },
    { id: "markup", label: "Markup" },
    { id: "totalNgn", label: "Total (NGN)" },
    { id: "commission", label: "Sales rep commission" },
    { id: "installation", label: "Installation" },
    { id: "qty", label: "Qty" },
    { id: "grand", label: "Grand total (NGN)" },
  ],
  Air: [
    { id: "sn", label: "S/N" },
    { id: "currency", label: "Currency" },
    { id: "item", label: "Item description" },
    { id: "base", label: "Base price" },
    { id: "other", label: "Other charges" },
    { id: "surcharge", label: "Energy surcharge" },
    { id: "bank1", label: "Bank 1" },
    { id: "bank2", label: "Bank 2" },
    { id: "freight", label: "Freight" },
    { id: "customs", label: "Custom duty" },
    { id: "soncap", label: "SONCAP" },
    { id: "agency", label: "Agency" },
    { id: "deliveryCity", label: "Delivery within Lagos" },
    { id: "deliveryOutside", label: "Delivery outside Lagos" },
    { id: "markup", label: "Markup" },
    { id: "subFx", label: "Sub-total (FX)" },
    { id: "exRate", label: "Ex-rate" },
    { id: "subNgn", label: "Sub-total (NGN)" },
    { id: "installation", label: "Installation" },
    { id: "commission", label: "Sales rep commission" },
    { id: "qty", label: "Qty" },
    { id: "grand", label: "Grand total (NGN)" },
  ],
  Sea: [
    { id: "sn", label: "S/N" },
    { id: "currency", label: "Currency" },
    { id: "item", label: "Item description" },
    { id: "qty", label: "Qty" },
    { id: "base", label: "Base price" },
    { id: "other", label: "Other charges" },
    { id: "surcharge", label: "Energy surcharge" },
    { id: "insurance", label: "Insurance" },
    { id: "bank1", label: "Bank 1" },
    { id: "bank2", label: "Bank 2" },
    { id: "freight", label: "Freight" },
    { id: "customs", label: "Custom duty" },
    { id: "soncap", label: "SONCAP" },
    { id: "shipping", label: "Shipping line" },
    { id: "warehouse", label: "Terminal + warehousing" },
    { id: "agency", label: "Agency" },
    { id: "delivery", label: "Delivery" },
    { id: "deliveryOutside", label: "Delivery outside Lagos" },
    { id: "markup", label: "Markup" },
    { id: "subFx", label: "Sub-total (FX)" },
    { id: "exRate", label: "Exchange rate" },
    { id: "subNgn", label: "Sub-total (NGN)" },
    { id: "installation", label: "Installation" },
    { id: "commission", label: "Sales rep commission" },
    { id: "grand", label: "Grand total (NGN)" },
  ],
};

export const UNIFIED_COLUMNS: { id: SheetColId; label: string; activeFor: SourceMode[] }[] = [
  { id: "sn", label: "S/N", activeFor: ["Local", "Air", "Sea"] },
  { id: "currency", label: "Currency", activeFor: ["Local", "Air", "Sea"] },
  { id: "item", label: "Item description", activeFor: ["Local", "Air", "Sea"] },
  { id: "qty", label: "Qty", activeFor: ["Local", "Air", "Sea"] },
  { id: "base", label: "Base price", activeFor: ["Local", "Air", "Sea"] },
  { id: "other", label: "Other charges", activeFor: ["Local", "Air", "Sea"] },
  { id: "surcharge", label: "Energy surcharge", activeFor: ["Air", "Sea"] },
  { id: "insurance", label: "Insurance", activeFor: ["Sea"] },
  { id: "bank1", label: "Bank 1", activeFor: ["Local", "Air", "Sea"] },
  { id: "bank2", label: "Bank 2", activeFor: ["Air", "Sea"] },
  { id: "freight", label: "Freight", activeFor: ["Air", "Sea"] },
  { id: "customs", label: "Custom duty", activeFor: ["Air", "Sea"] },
  { id: "soncap", label: "SONCAP", activeFor: ["Air", "Sea"] },
  { id: "shipping", label: "Shipping line", activeFor: ["Sea"] },
  { id: "warehouse", label: "Terminal + warehousing", activeFor: ["Sea"] },
  { id: "agency", label: "Agency", activeFor: ["Air", "Sea"] },
  { id: "deliveryCity", label: "Delivery within city", activeFor: ["Local", "Air"] },
  { id: "delivery", label: "Delivery", activeFor: ["Sea"] },
  { id: "deliveryOutside", label: "Delivery outside Lagos", activeFor: ["Local", "Air", "Sea"] },
  { id: "markup", label: "Markup", activeFor: ["Local", "Air", "Sea"] },
  { id: "subFx", label: "Sub-total (FX)", activeFor: ["Air", "Sea"] },
  { id: "exRate", label: "Ex-rate", activeFor: ["Air", "Sea"] },
  { id: "totalNgn", label: "Total (NGN)", activeFor: ["Local"] },
  { id: "subNgn", label: "Sub-total (NGN)", activeFor: ["Air", "Sea"] },
  { id: "installation", label: "Installation", activeFor: ["Local", "Air", "Sea"] },
  { id: "commission", label: "Sales rep commission", activeFor: ["Local", "Air", "Sea"] },
  { id: "grand", label: "Grand total (NGN)", activeFor: ["Local", "Air", "Sea"] },
];

export function columnActive(id: SheetColId, source: SourceMode) {
  const column = UNIFIED_COLUMNS.find((entry) => entry.id === id);
  return column ? column.activeFor.includes(source) : true;
}

export const SHEET_NOTES: Record<SourceMode, string> = {
  Local: "Local purchase uses NGN. Foreign-only charges stay visible but inactive.",
  Air: "Airport / courier uses foreign currency. Local-only charges stay visible but inactive.",
  Sea: "Sea freight uses foreign currency. Local-only charges stay visible but inactive.",
};
