import { WORKFLOW_STEPS } from "@/lib/constants";
import { DEFAULT_RATES, summarizeSheet } from "@/lib/estimation";
import type {
  AuditEvent,
  DashboardSummary,
  EstimateRecord,
  EstimateStatus,
  ExchangeRateTable,
  ReviewStage,
  SheetCurrency,
  SheetLine,
  SheetRecord,
  SourceMode,
} from "@/lib/types";
import { cloneSheet, emptySheet, memoryStore } from "@/lib/db/memory";

const SOURCES = new Set<SourceMode>(["Local", "Air", "Sea"]);
const CURRENCIES = new Set<SheetCurrency>(["NGN", "USD", "EUR", "GBP"]);

function text(value?: string) {
  return value?.trim() ?? "";
}

function normalizeEstimate(estimate: EstimateRecord): EstimateRecord {
  return {
    ...estimate,
    attachments: [...(estimate.attachments ?? [])],
    reviewStage: estimate.reviewStage ?? "draft",
    version: estimate.version || "v1",
    submittedAt: estimate.submittedAt ?? null,
    submittedBy: estimate.submittedBy ?? null,
    totalNgn: estimate.totalNgn ?? null,
  };
}

export function recordAudit(event: Omit<AuditEvent, "id" | "at">) {
  const store = memoryStore();
  const entry: AuditEvent = {
    id: `AUD-${String(store.audit.length + 1).padStart(3, "0")}`,
    at: new Date().toISOString(),
    ...event,
  };
  store.audit = [entry, ...store.audit];
  return entry;
}

export function listEstimates() {
  return memoryStore().estimates.map(normalizeEstimate);
}

export function getEstimate(id: string) {
  const found = memoryStore().estimates.find((estimate) => estimate.id === id);
  return found ? normalizeEstimate(found) : null;
}

export function createEstimate(input: {
  title: string;
  clientName?: string;
  tenderNumber?: string;
  contact?: string;
  department?: string;
  dateReceived?: string;
  deadline?: string;
  accountManager?: string;
  originator?: string;
  description?: string;
  remarks?: string;
  attachments?: string[];
  mode?: string;
  status?: EstimateStatus;
}) {
  const store = memoryStore();
  const record: EstimateRecord = {
    id: `EST-2026-${String(store.estimates.length + 1).padStart(3, "0")}`,
    title: text(input.title),
    clientName: text(input.clientName),
    tenderNumber: text(input.tenderNumber),
    contact: text(input.contact),
    department: text(input.department),
    dateReceived: text(input.dateReceived),
    deadline: text(input.deadline),
    accountManager: text(input.accountManager),
    originator: text(input.originator),
    description: text(input.description),
    remarks: text(input.remarks),
    attachments: input.attachments?.map((name) => name.trim()).filter(Boolean) ?? [],
    mode: text(input.mode) || "Air freight",
    status: input.status ?? "pending",
    reviewStage: "draft",
    version: "v1",
    submittedAt: null,
    submittedBy: null,
    totalNgn: null,
    createdAt: new Date().toISOString(),
  };
  store.estimates = [record, ...store.estimates];
  recordAudit({
    actor: record.originator || "Representative",
    action: "estimate.created",
    estimateId: record.id,
    detail: record.title,
  });
  return normalizeEstimate(record);
}

export function updateEstimate(
  id: string,
  patch: Partial<Pick<EstimateRecord, "title" | "clientName" | "status" | "reviewStage" | "totalNgn" | "remarks">>,
) {
  const estimate = memoryStore().estimates.find((item) => item.id === id);
  if (!estimate) return null;
  if (patch.title != null) estimate.title = text(patch.title);
  if (patch.clientName != null) estimate.clientName = text(patch.clientName);
  if (patch.remarks != null) estimate.remarks = text(patch.remarks);
  if (patch.status) estimate.status = patch.status;
  if (patch.reviewStage) estimate.reviewStage = patch.reviewStage;
  if (patch.totalNgn !== undefined) estimate.totalNgn = patch.totalNgn;
  return normalizeEstimate(estimate);
}

export function deleteEstimate(id: string) {
  const store = memoryStore();
  const exists = store.estimates.some((estimate) => estimate.id === id);
  if (!exists) return false;
  store.estimates = store.estimates.filter((estimate) => estimate.id !== id);
  delete store.sheets[id];
  return true;
}

function syncEstimate(id: string, totalNgn: number, stage: ReviewStage) {
  const estimate = memoryStore().estimates.find((item) => item.id === id);
  if (!estimate) return;
  estimate.totalNgn = totalNgn;
  estimate.reviewStage = stage;
  if (stage === "approved") estimate.status = "approved";
  else if (stage === "returned") estimate.status = "rejected";
  else estimate.status = "pending";
}

export function getSheet(id: string, version = "v1") {
  const stored = memoryStore().sheets[id];
  return stored ? cloneSheet(stored) : emptySheet(id, version);
}

export function sheetResponse(id: string, version = "v1") {
  const sheet = getSheet(id, version);
  const rates = getExchangeRates();
  return {
    ...sheet,
    rates,
    summary: summarizeSheet(sheet.lines, rates),
  };
}

function cleanLine(line: Partial<SheetLine>, index: number): SheetLine | null {
  const source = SOURCES.has(line.source as SourceMode) ? (line.source as SourceMode) : "Local";
  const currency = CURRENCIES.has(line.currency as SheetCurrency)
    ? (line.currency as SheetCurrency)
    : "NGN";
  const item = text(line.item);
  const qty = text(line.qty);
  const base = text(line.base);
  const freight = text(line.freight);
  const msc = text(line.msc);
  if (!item && !qty && !base && !freight && !msc) return null;
  return {
    id: text(line.id) || `line-${index + 1}`,
    item,
    source,
    currency,
    qty,
    base,
    freight,
    msc,
  };
}

export function saveSheet(id: string, lines: Partial<SheetLine>[], version = "v1", actor = "Representative") {
  const store = memoryStore();
  const current = store.sheets[id] ?? emptySheet(id, version);
  if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
    return { error: "This estimate is locked while it is in review." as const };
  }

  const nextLines = lines
    .map((line, index) => cleanLine(line, index))
    .filter((line): line is SheetLine => Boolean(line));
  const previousIds = new Set(current.lines.map((line) => line.id));
  const sheet: SheetRecord = {
    ...current,
    estimateId: id,
    version: current.version || version,
    reviewStage: current.reviewStage === "returned" ? "draft" : current.reviewStage,
    lines: nextLines,
  };
  store.sheets[id] = sheet;
  const summary = summarizeSheet(nextLines, store.rates);
  syncEstimate(id, summary.grandTotalNgn, sheet.reviewStage);
  const added = nextLines.filter((line) => line.item.trim() && !previousIds.has(line.id));
  if (added.length === 0) {
    recordAudit({
      actor,
      action: "sheet.saved",
      estimateId: id,
      detail: `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"}`,
    });
  } else {
    added.forEach(() => {
      recordAudit({
        actor,
        action: "item.added",
        estimateId: id,
        detail: "Item added",
      });
    });
  }
  return { sheet: sheetResponse(id, version) };
}

export function submitSheet(id: string, actor: string, version = "v1") {
  const store = memoryStore();
  const current = store.sheets[id] ?? emptySheet(id, version);
  const named = current.lines.filter((line) => line.item.trim());
  if (named.length === 0) {
    return { error: "Add an item before submitting for review." as const };
  }
  if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
    return { error: "This estimate has already been submitted." as const };
  }

  const sheet: SheetRecord = {
    ...current,
    version: current.version || version,
    reviewStage: "in_review",
    submittedAt: new Date().toISOString(),
    submittedBy: actor,
  };
  store.sheets[id] = sheet;
  const summary = summarizeSheet(sheet.lines, store.rates);
  syncEstimate(id, summary.grandTotalNgn, "in_review");
  recordAudit({
    actor,
    action: "sheet.submitted",
    estimateId: id,
    detail: `${sheet.version} sent for line manager review`,
  });
  return { sheet: sheetResponse(id, version) };
}

export function decideSheet(id: string, decision: "approved" | "returned", actor: string) {
  const current = memoryStore().sheets[id];
  if (!current || current.reviewStage !== "in_review") {
    return { error: "There is no estimate waiting for a decision." as const };
  }
  current.reviewStage = decision === "approved" ? "approved" : "returned";
  const summary = summarizeSheet(current.lines, memoryStore().rates);
  syncEstimate(id, summary.grandTotalNgn, current.reviewStage);
  recordAudit({
    actor,
    action: decision === "approved" ? "sheet.approved" : "sheet.returned",
    estimateId: id,
    detail: current.version,
  });
  return { sheet: sheetResponse(id) };
}

export function getExchangeRates() {
  return { ...DEFAULT_RATES, ...memoryStore().rates };
}

export function saveExchangeRates(patch: Partial<ExchangeRateTable>) {
  const rates = getExchangeRates();
  (Object.keys(DEFAULT_RATES) as SheetCurrency[]).forEach((currency) => {
    const next = patch[currency];
    if (typeof next === "number" && Number.isFinite(next) && next > 0) rates[currency] = next;
  });
  rates.NGN = 1;
  memoryStore().rates = rates;
  return { ...rates };
}

export function listClients() {
  const clients = new Map<string, { name: string; estimates: number }>();
  for (const estimate of listEstimates()) {
    const name = estimate.clientName.trim();
    if (!name) continue;
    const current = clients.get(name) ?? { name, estimates: 0 };
    current.estimates += 1;
    clients.set(name, current);
  }
  return [...clients.values()];
}

export function listAudit() {
  return memoryStore().audit.map((event) => ({ ...event }));
}

export function listReports() {
  return listEstimates()
    .filter((estimate) => estimate.status === "approved" || estimate.reviewStage === "approved")
    .map((estimate) => ({
      id: estimate.id,
      title: estimate.title,
      clientName: estimate.clientName,
      totalNgn: estimate.totalNgn,
      version: estimate.version,
    }));
}

export function getDashboardSummary(): DashboardSummary {
  const estimates = listEstimates();
  const count = (status: EstimateStatus) =>
    estimates.filter((estimate) => estimate.status === status).length;

  return {
    steps: WORKFLOW_STEPS,
    progress: estimates.length === 0 ? 3 : 28,
    stats: [
      { key: "total", label: "Total estimates", value: estimates.length, tone: "purple" },
      { key: "pending", label: "Pending review", value: count("pending"), tone: "orange" },
      { key: "approved", label: "Approved", value: count("approved"), tone: "green" },
      { key: "rejected", label: "Returned / Rejected", value: count("rejected"), tone: "red" },
    ],
  };
}
