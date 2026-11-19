import { DEFAULT_RATES } from "@/lib/estimation";
import type {
  AuditEvent,
  EstimateRecord,
  ExchangeRateTable,
  SheetLine,
  SheetRecord,
} from "@/lib/types";

export type MemoryStore = {
  estimates: EstimateRecord[];
  sheets: Record<string, SheetRecord>;
  rates: ExchangeRateTable;
  audit: AuditEvent[];
};

const globalStore = globalThis as typeof globalThis & { __v11Store?: MemoryStore };

export function memoryStore() {
  if (!globalStore.__v11Store) {
    globalStore.__v11Store = {
      estimates: [],
      sheets: {},
      rates: { ...DEFAULT_RATES },
      audit: [],
    };
  }

  const current = globalStore.__v11Store;
  current.sheets ??= {};
  current.rates ??= { ...DEFAULT_RATES };
  current.audit ??= [];
  return current;
}

export function cloneSheet(sheet: SheetRecord): SheetRecord {
  return {
    ...sheet,
    lines: sheet.lines.map((line) => ({ ...line })),
  };
}

export function emptySheet(estimateId: string, version = "v1"): SheetRecord {
  return {
    estimateId,
    version,
    reviewStage: "draft",
    lines: [],
    submittedAt: null,
    submittedBy: null,
  };
}

export function cloneLine(line: SheetLine): SheetLine {
  return { ...line };
}
