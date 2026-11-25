import { currencyFor } from "@/lib/estimation";
import type { SheetLine, SourceMode } from "@/lib/types";

export function isLocalSource(line: Pick<SheetLine, "source" | "sourcing">) {
  return line.source === "Local" || line.sourcing === "Local";
}

export function blankSheetLine(id: string, source: SourceMode = "Local"): SheetLine {
  return {
    id,
    item: "",
    source,
    currency: currencyFor(source),
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
    sourcing: source === "Local" ? "Local" : "Foreign",
    delivery: "",
    deliveryOutside: "",
    warehouse: "",
    markup: "",
    installation: "",
    applySoncap: false,
    bank1Amount: "",
    soncapAmount: "",
  };
}

export function applySource(line: SheetLine, source: SourceMode): SheetLine {
  const local = source === "Local";
  return {
    ...line,
    source,
    sourcing: local ? "Local" : "Foreign",
    currency: local ? "NGN" : currencyFor(source),
  };
}
