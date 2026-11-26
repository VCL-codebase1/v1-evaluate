import type { SourceMode } from "@/lib/types";

export const SHEET_TABS: { source: SourceMode; label: string }[] = [
  { source: "Local", label: "Local purchase" },
  { source: "Air", label: "Foreign courier / airport" },
  { source: "Sea", label: "Sea freight" },
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

export const SHEET_NOTES: Record<SourceMode, string> = {
  Local: "Delivery outside the city or state should be treated case by case and is not taken from the standard within-city rate.",
  Air: "SONCAP may apply. Processing is usually USD 750 per shipment, divided across the line quantity. Commission and installation are bonus figures and are not in the line total.",
  Sea: "SONCAP may apply. Processing is usually USD 750 per shipment, divided across the line quantity. Commission and installation are bonus figures and are not in the line total.",
};
