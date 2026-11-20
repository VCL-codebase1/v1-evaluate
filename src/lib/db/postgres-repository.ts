import { WORKFLOW_STEPS } from "@/lib/constants";
import { DEFAULT_RATES, summarizeSheet } from "@/lib/estimation";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
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

const SOURCES = new Set<SourceMode>(["Local", "Air", "Sea"]);
const CURRENCIES = new Set<SheetCurrency>(["NGN", "USD", "EUR", "GBP"]);

function text(value?: string | null) {
  return (value ?? "").trim();
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapEstimate(row: Record<string, unknown>): EstimateRecord {
  const attachments = Array.isArray(row.attachments)
    ? (row.attachments.filter((v): v is string => typeof v === "string"))
    : [];
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    clientName: String(row.client_name ?? ""),
    tenderNumber: String(row.tender_number ?? ""),
    contact: String(row.contact ?? ""),
    department: String(row.department ?? ""),
    dateReceived: String(row.date_received ?? ""),
    deadline: String(row.deadline ?? ""),
    accountManager: String(row.account_manager ?? ""),
    originator: String(row.originator ?? ""),
    description: String(row.description ?? ""),
    remarks: String(row.remarks ?? ""),
    attachments,
    mode: String(row.mode ?? "Air freight"),
    status: String(row.status ?? "pending") as EstimateStatus,
    reviewStage: String(row.review_stage ?? "draft") as ReviewStage,
    version: String(row.version ?? "v1"),
    submittedAt: toIso(row.submitted_at),
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    totalNgn: toNum(row.total_ngn),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function emptySheet(estimateId: string, version = "v1"): SheetRecord {
  return { estimateId, version, reviewStage: "draft", lines: [], submittedAt: null, submittedBy: null };
}

function mapSheet(row: Record<string, unknown>): SheetRecord {
  const lines = Array.isArray(row.lines) ? (row.lines as SheetLine[]) : [];
  return {
    estimateId: String(row.estimate_id),
    version: String(row.version ?? "v1"),
    reviewStage: String(row.review_stage ?? "draft") as ReviewStage,
    lines: lines.map((l) => ({ ...l })),
    submittedAt: toIso(row.submitted_at),
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
  };
}

async function nextCounter(name: "estimate" | "audit") {
  await ensureDb();
  const db = sql();
  const rows = await db`
    update counters set value = value + 1 where name = ${name} returning value
  `;
  return Number(rows[0]?.value ?? 1);
}

export async function recordAudit(event: Omit<AuditEvent, "id" | "at">) {
  await ensureDb();
  const db = sql();
  const seq = await nextCounter("audit");
  const id = `AUD-${String(seq).padStart(3, "0")}`;
  const rows = await db`
    insert into audit_events(event_ref, actor, role, action, estimate_id, detail)
    values (${id}, ${event.actor}, ${(event as { role?: string }).role ?? null}, ${event.action}, ${event.estimateId}, ${event.detail})
    returning event_ref, at, actor, role, action, estimate_id, detail
  `;
  const row = rows[0];
  return {
    id: String(row.event_ref),
    at: toIso(row.at) ?? new Date().toISOString(),
    actor: String(row.actor),
    action: String(row.action),
    estimateId: String(row.estimate_id),
    detail: String(row.detail ?? ""),
  } as AuditEvent;
}

export async function listEstimates() {
  await ensureDb();
  const rows = await sql()`select * from estimates order by created_at desc`;
  return rows.map((r) => mapEstimate(r as Record<string, unknown>));
}

export async function getEstimate(id: string) {
  await ensureDb();
  const rows = await sql()`select * from estimates where id = ${id} limit 1`;
  return rows[0] ? mapEstimate(rows[0] as Record<string, unknown>) : null;
}

export async function createEstimate(input: {
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
  await ensureDb();
  const seq = await nextCounter("estimate");
  const year = new Date().getUTCFullYear();
  const id = `EST-${year}-${String(seq).padStart(3, "0")}`;
  const attachments = input.attachments?.map((n) => n.trim()).filter(Boolean) ?? [];
  const rows = await sql()`
    insert into estimates(
      id, title, client_name, tender_number, contact, department, date_received, deadline,
      account_manager, originator, description, remarks, attachments, mode, status,
      review_stage, workflow_step, version
    ) values (
      ${id}, ${text(input.title)}, ${text(input.clientName)}, ${text(input.tenderNumber)},
      ${text(input.contact)}, ${text(input.department)}, ${text(input.dateReceived)}, ${text(input.deadline)},
      ${text(input.accountManager)}, ${text(input.originator)}, ${text(input.description)}, ${text(input.remarks)},
      ${sql().json(attachments)}::jsonb, ${text(input.mode) || "Air freight"}, ${input.status ?? "pending"},
      ${"draft"}, ${"created"}, ${"v1"}
    ) returning *
  `;
  await recordAudit({
    actor: text(input.originator) || "Representative",
    action: "estimate.created",
    estimateId: id,
    detail: text(input.title),
  });
  return mapEstimate(rows[0] as Record<string, unknown>);
}

export async function updateEstimate(
  id: string,
  patch: Partial<Pick<EstimateRecord, "title" | "clientName" | "status" | "reviewStage" | "totalNgn" | "remarks">>,
) {
  await ensureDb();
  const current = await getEstimate(id);
  if (!current) return null;
  const title = patch.title != null ? text(patch.title) : current.title;
  const clientName = patch.clientName != null ? text(patch.clientName) : current.clientName;
  const remarks = patch.remarks != null ? text(patch.remarks) : current.remarks;
  const status = patch.status ?? current.status;
  const reviewStage = patch.reviewStage ?? current.reviewStage;
  const totalNgn = patch.totalNgn !== undefined ? patch.totalNgn : current.totalNgn;
  const rows = await sql()`
    update estimates set
      title = ${title}, client_name = ${clientName}, remarks = ${remarks},
      status = ${status}, review_stage = ${reviewStage}, total_ngn = ${totalNgn},
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return rows[0] ? mapEstimate(rows[0] as Record<string, unknown>) : null;
}

export async function deleteEstimate(id: string) {
  await ensureDb();
  const rows = await sql()`delete from estimates where id = ${id} returning id`;
  return rows.length > 0;
}

export async function getSheet(id: string, version = "v1") {
  await ensureDb();
  const rows = await sql()`select * from estimate_sheets where estimate_id = ${id} limit 1`;
  return rows[0] ? mapSheet(rows[0] as Record<string, unknown>) : emptySheet(id, version);
}

export async function getExchangeRates(): Promise<ExchangeRateTable> {
  await ensureDb();
  const rows = await sql()`select currency, rate from exchange_rates`;
  const rates: ExchangeRateTable = { ...DEFAULT_RATES };
  for (const row of rows) {
    const currency = String(row.currency) as SheetCurrency;
    if (currency in rates) rates[currency] = Number(row.rate);
  }
  rates.NGN = 1;
  return rates;
}

export async function sheetResponse(id: string, version = "v1") {
  const sheet = await getSheet(id, version);
  const rates = await getExchangeRates();
  return { ...sheet, rates, summary: summarizeSheet(sheet.lines, rates) };
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

async function syncEstimate(id: string, totalNgn: number, stage: ReviewStage) {
  const status = stage === "approved" ? "approved" : stage === "returned" ? "rejected" : "pending";
  await sql()`
    update estimates set total_ngn = ${totalNgn}, review_stage = ${stage}, status = ${status}, updated_at = now()
    where id = ${id}
  `;
}

export async function saveSheet(id: string, lines: Partial<SheetLine>[], version = "v1", actor = "Representative") {
  await ensureDb();
  const current = await getSheet(id, version);
  if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
    return { error: "This estimate is locked while it is in review." as const };
  }

  const nextLines = lines
    .map((line, index) => cleanLine(line, index))
    .filter((line): line is SheetLine => Boolean(line));
  const previousIds = new Set(current.lines.map((line) => line.id));
  const nextStage: ReviewStage = current.reviewStage === "returned" ? "draft" : current.reviewStage;

  await sql()`
    insert into estimate_sheets(estimate_id, version, review_stage, lines, submitted_at, submitted_by, updated_at)
    values (${id}, ${current.version || version}, ${nextStage}, ${sql().json(nextLines)}::jsonb, ${current.submittedAt}, ${current.submittedBy}, now())
    on conflict (estimate_id) do update set
      version = excluded.version,
      review_stage = excluded.review_stage,
      lines = excluded.lines,
      submitted_at = excluded.submitted_at,
      submitted_by = excluded.submitted_by,
      updated_at = now()
  `;

  const rates = await getExchangeRates();
  const summary = summarizeSheet(nextLines, rates);
  await syncEstimate(id, summary.grandTotalNgn, nextStage);

  const added = nextLines.filter((line) => line.item.trim() && !previousIds.has(line.id));
  if (added.length === 0) {
    await recordAudit({
      actor,
      action: "sheet.saved",
      estimateId: id,
      detail: `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"}`,
    });
  } else {
    for (let i = 0; i < added.length; i += 1) {
      await recordAudit({ actor, action: "item.added", estimateId: id, detail: "Item added" });
    }
  }

  return { sheet: await sheetResponse(id, version) };
}

export async function submitSheet(id: string, actor: string, version = "v1") {
  await ensureDb();
  const current = await getSheet(id, version);
  const named = current.lines.filter((line) => line.item.trim());
  if (named.length === 0) {
    return { error: "Add an item before submitting for review." as const };
  }
  if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
    return { error: "This estimate has already been submitted." as const };
  }

  const submittedAt = new Date().toISOString();
  await sql()`
    insert into estimate_sheets(estimate_id, version, review_stage, lines, submitted_at, submitted_by, updated_at)
    values (${id}, ${current.version || version}, ${"in_review"}, ${sql().json(current.lines)}::jsonb, ${submittedAt}, ${actor}, now())
    on conflict (estimate_id) do update set
      version = excluded.version,
      review_stage = excluded.review_stage,
      submitted_at = excluded.submitted_at,
      submitted_by = excluded.submitted_by,
      updated_at = now()
  `;
  const rates = await getExchangeRates();
  const summary = summarizeSheet(current.lines, rates);
  await syncEstimate(id, summary.grandTotalNgn, "in_review");
  await recordAudit({
    actor,
    action: "sheet.submitted",
    estimateId: id,
    detail: `${current.version || version} sent for line manager review`,
  });
  return { sheet: await sheetResponse(id, version) };
}

export async function decideSheet(id: string, decision: "approved" | "returned", actor: string) {
  await ensureDb();
  const currentRows = await sql()`select * from estimate_sheets where estimate_id = ${id} limit 1`;
  const current = currentRows[0] ? mapSheet(currentRows[0] as Record<string, unknown>) : null;
  if (!current || current.reviewStage !== "in_review") {
    return { error: "There is no estimate waiting for a decision." as const };
  }
  const nextStage: ReviewStage = decision === "approved" ? "approved" : "returned";
  await sql()`
    update estimate_sheets set review_stage = ${nextStage}, updated_at = now() where estimate_id = ${id}
  `;
  const rates = await getExchangeRates();
  const summary = summarizeSheet(current.lines, rates);
  await syncEstimate(id, summary.grandTotalNgn, nextStage);
  await recordAudit({
    actor,
    action: decision === "approved" ? "sheet.approved" : "sheet.returned",
    estimateId: id,
    detail: current.version,
  });
  return { sheet: await sheetResponse(id) };
}

export async function saveExchangeRates(patch: Partial<ExchangeRateTable>) {
  await ensureDb();
  const rates = await getExchangeRates();
  (Object.keys(DEFAULT_RATES) as SheetCurrency[]).forEach((currency) => {
    const next = patch[currency];
    if (typeof next === "number" && Number.isFinite(next) && next > 0) rates[currency] = next;
  });
  rates.NGN = 1;
  for (const [currency, rate] of Object.entries(rates)) {
    await sql()`
      insert into exchange_rates(currency, rate) values (${currency}, ${rate})
      on conflict (currency) do update set rate = excluded.rate
    `;
  }
  return { ...rates };
}

export async function listClients() {
  const estimates = await listEstimates();
  const clients = new Map<string, { name: string; estimates: number }>();
  for (const estimate of estimates) {
    const name = estimate.clientName.trim();
    if (!name) continue;
    const current = clients.get(name) ?? { name, estimates: 0 };
    current.estimates += 1;
    clients.set(name, current);
  }
  return [...clients.values()];
}

export async function listAudit() {
  await ensureDb();
  const rows = await sql()`select event_ref, at, actor, role, action, estimate_id, detail from audit_events order by at desc limit 500`;
  return rows.map((row) => ({
    id: String(row.event_ref),
    at: toIso(row.at) ?? new Date().toISOString(),
    actor: String(row.actor),
    action: String(row.action),
    estimateId: String(row.estimate_id),
    detail: String(row.detail ?? ""),
  })) as AuditEvent[];
}

export async function listReports() {
  const estimates = await listEstimates();
  return estimates
    .filter((estimate) => estimate.status === "approved" || estimate.reviewStage === "approved")
    .map((estimate) => ({
      id: estimate.id,
      title: estimate.title,
      clientName: estimate.clientName,
      totalNgn: estimate.totalNgn,
      version: estimate.version,
    }));
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const estimates = await listEstimates();
  const count = (status: EstimateStatus) => estimates.filter((estimate) => estimate.status === status).length;

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
