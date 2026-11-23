import { WORKFLOW_STEPS } from "@/lib/constants";
import { DEFAULT_RATES, summarizeSheet } from "@/lib/estimation";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import type {
  AuditEvent,
  DashboardSummary,
  EstimateRecord,
  EstimateStatus,
  ExchangeFloatation,
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
    ? row.attachments.filter((v): v is string => typeof v === "string")
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
    workflowStep: String(row.workflow_step ?? "created"),
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

export async function recordAudit(event: Omit<AuditEvent, "id" | "at"> & { organizationId: string }) {
  await ensureDb();
  const db = sql();
  const seq = await nextCounter("audit");
  const id = `AUD-${String(seq).padStart(3, "0")}`;
  const rows = await db`
    insert into audit_events(event_ref, organization_id, actor, role, action, estimate_id, detail)
    values (${id}, ${event.organizationId}, ${event.actor}, ${(event as { role?: string }).role ?? null}, ${event.action}, ${event.estimateId}, ${event.detail})
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

export async function listEstimates(organizationId: string) {
  await ensureDb();
  const rows = await sql()`select * from estimates where organization_id = ${organizationId} order by created_at desc`;
  return rows.map((r) => mapEstimate(r as Record<string, unknown>));
}

export async function getLatestEstimateId(organizationId: string) {
  await ensureDb();
  const rows = await sql()`select id from estimates where organization_id = ${organizationId} order by created_at desc limit 1`;
  return rows[0] ? String((rows[0] as { id: unknown }).id) : null;
}

export async function getEstimate(id: string, organizationId: string) {
  await ensureDb();
  const rows = await sql()`select * from estimates where id = ${id} and organization_id = ${organizationId} limit 1`;
  return rows[0] ? mapEstimate(rows[0] as Record<string, unknown>) : null;
}

export async function createEstimate(input: {
  title: string;
  organizationId: string;
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
      id, organization_id, title, client_name, tender_number, contact, department, date_received, deadline,
      account_manager, originator, description, remarks, attachments, mode, status,
      review_stage, workflow_step, version
    ) values (
      ${id}, ${input.organizationId}, ${text(input.title)}, ${text(input.clientName)}, ${text(input.tenderNumber)},
      ${text(input.contact)}, ${text(input.department)}, ${text(input.dateReceived)}, ${text(input.deadline)},
      ${text(input.accountManager)}, ${text(input.originator)}, ${text(input.description)}, ${text(input.remarks)},
      ${sql().json(attachments)}::jsonb, ${text(input.mode) || "Air freight"}, ${input.status ?? "pending"},
      ${"draft"}, ${"created"}, ${"v1"}
    ) returning *
  `;
  await recordAudit({
    organizationId: input.organizationId,
    actor: text(input.originator) || "Representative",
    action: "estimate.created",
    estimateId: id,
    detail: text(input.title),
  });
  return mapEstimate(rows[0] as Record<string, unknown>);
}

export async function updateEstimate(
  id: string,
  organizationId: string,
  patch: Partial<Pick<EstimateRecord, "title" | "clientName" | "status" | "reviewStage" | "totalNgn" | "remarks">>,
) {
  await ensureDb();
  const current = await getEstimate(id, organizationId);
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
    where id = ${id} and organization_id = ${organizationId}
    returning *
  `;
  return rows[0] ? mapEstimate(rows[0] as Record<string, unknown>) : null;
}

export async function deleteEstimate(id: string, organizationId: string) {
  await ensureDb();
  const rows = await sql()`delete from estimates where id = ${id} and organization_id = ${organizationId} returning id`;
  return rows.length > 0;
}

export async function getSheet(id: string, organizationId: string, version = "v1") {
  await ensureDb();
  // Ensure estimate belongs to org
  const est = await getEstimate(id, organizationId);
  if (!est) return null;
  const rows = await sql()`select * from estimate_sheets where estimate_id = ${id} limit 1`;
  return rows[0] ? mapSheet(rows[0] as Record<string, unknown>) : emptySheet(id, version);
}

const EMPTY_FLOATATION: ExchangeFloatation = { USD: 0, EUR: 0, GBP: 0 };

export async function getExchangeRateSettings(organizationId: string): Promise<{
  rates: ExchangeRateTable;
  floatation: ExchangeFloatation;
}> {
  await ensureDb();
  const rows = await sql()`select currency, rate, floatation from exchange_rates where organization_id = ${organizationId}`;
  const rates: ExchangeRateTable = { ...DEFAULT_RATES };
  const floatation: ExchangeFloatation = { ...EMPTY_FLOATATION };
  for (const row of rows) {
    const currency = String(row.currency) as SheetCurrency;
    if (currency in rates) rates[currency] = Number(row.rate);
    if (currency === "USD" || currency === "EUR" || currency === "GBP") {
      const difference = Number(row.floatation);
      floatation[currency] = Number.isFinite(difference) ? difference : 0;
    }
  }
  rates.NGN = 1;
  return { rates, floatation };
}

export async function getExchangeRates(organizationId: string): Promise<ExchangeRateTable> {
  const settings = await getExchangeRateSettings(organizationId);
  return settings.rates;
}

export async function sheetResponse(id: string, organizationId: string, version = "v1") {
  const sheet = await getSheet(id, organizationId, version);
  if (!sheet) return null;
  const rates = await getExchangeRates(organizationId);
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
  if (!item && !qty && !base && !freight && !msc && !text(line.itemNumber) && !text(line.manufacturer)) return null;
  return {
    id: text(line.id) || `line-${index + 1}`,
    item,
    source,
    currency,
    qty,
    base,
    freight,
    msc,
    itemNumber: text(line.itemNumber),
    manufacturer: text(line.manufacturer),
    model: text(line.model),
    partNumber: text(line.partNumber),
    specification: text(line.specification),
    unit: text(line.unit),
    supplier: text(line.supplier),
    sourcing: line.sourcing === "Foreign" ? "Foreign" : line.sourcing === "Local" ? "Local" : undefined,
    delivery: text(line.delivery),
    warehouse: text(line.warehouse),
    markup: text(line.markup),
  };
}

function requireConfiguredRates(lines: SheetLine[], rates: ExchangeRateTable) {
  const currencies = [...new Set(lines.map((line) => line.currency))];
  const missing = currencies.filter((currency) => currency !== "NGN" && (!rates[currency] || rates[currency] <= 0));
  if (missing.length > 0) {
    throw new Error(`Configure NGN exchange rates for ${missing.join(", ")} before saving this estimate.`);
  }
}

async function syncEstimate(id: string, organizationId: string, totalNgn: number, stage: ReviewStage) {
  const status = stage === "approved" ? "approved" : stage === "returned" ? "rejected" : "pending";
  await sql()`
    update estimates set total_ngn = ${totalNgn}, review_stage = ${stage}, status = ${status}, updated_at = now()
    where id = ${id} and organization_id = ${organizationId}
  `;
}

export async function saveSheet(
  id: string,
  organizationId: string,
  lines: Partial<SheetLine>[],
  version = "v1",
  actor = "Representative",
) {
  await ensureDb();
  const current = await getSheet(id, organizationId, version);
  if (!current) return { error: "Estimate not found." as const };
  if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
    return { error: "This estimate is locked while it is in review." as const };
  }

  const nextLines = lines
    .map((line, index) => cleanLine(line, index))
    .filter((line): line is SheetLine => Boolean(line));
  const rates = await getExchangeRates(organizationId);
  requireConfiguredRates(nextLines, rates);
  const previousIds = new Set(current.lines.map((line) => line.id));
  const nextStage: ReviewStage = current.reviewStage === "returned" ? "draft" : current.reviewStage;
  const sheetVersion = current.version || version;

  await sql()`
    insert into estimate_sheets(estimate_id, version, review_stage, lines, submitted_at, submitted_by, updated_at)
    values (${id}, ${sheetVersion}, ${nextStage}, ${sql().json(nextLines)}::jsonb, ${current.submittedAt}, ${current.submittedBy}, now())
    on conflict (estimate_id) do update set
      version = excluded.version,
      review_stage = excluded.review_stage,
      lines = excluded.lines,
      submitted_at = excluded.submitted_at,
      submitted_by = excluded.submitted_by,
      updated_at = now()
  `;

  const summary = summarizeSheet(nextLines, rates);
  await syncEstimate(id, organizationId, summary.grandTotalNgn, nextStage);

  const addedCount = nextLines.filter((line) => line.item.trim() && !previousIds.has(line.id)).length;
  const detail =
    addedCount > 0
      ? `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"} (${addedCount} added)`
      : `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"}`;
  await recordAudit({
    organizationId,
    actor,
    action: "sheet.saved",
    estimateId: id,
    detail,
  });

  return {
    sheet: {
      estimateId: id,
      version: sheetVersion,
      reviewStage: nextStage,
      lines: nextLines,
      submittedAt: current.submittedAt,
      submittedBy: current.submittedBy,
      rates,
      summary,
    },
  };
}

export async function submitSheet(id: string, organizationId: string, actor: string, version = "v1") {
  await ensureDb();
  const current = await getSheet(id, organizationId, version);
  if (!current) return { error: "Estimate not found." as const };
  const named = current.lines.filter((line) => line.item.trim());
  if (named.length === 0) {
    return { error: "Add an item before submitting for review." as const };
  }
  if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
    return { error: "This estimate has already been submitted." as const };
  }

  const rates = await getExchangeRates(organizationId);
  requireConfiguredRates(named, rates);

  const submittedAt = new Date().toISOString();
  const sheetVersion = current.version || version;
  await sql()`
    insert into estimate_sheets(estimate_id, version, review_stage, lines, submitted_at, submitted_by, updated_at)
    values (${id}, ${sheetVersion}, ${"in_review"}, ${sql().json(current.lines)}::jsonb, ${submittedAt}, ${actor}, now())
    on conflict (estimate_id) do update set
      version = excluded.version,
      review_stage = excluded.review_stage,
      submitted_at = excluded.submitted_at,
      submitted_by = excluded.submitted_by,
      updated_at = now()
  `;
  const summary = summarizeSheet(current.lines, rates);
  await syncEstimate(id, organizationId, summary.grandTotalNgn, "in_review");
  await recordAudit({
    organizationId,
    actor,
    action: "sheet.submitted",
    estimateId: id,
    detail: `${sheetVersion} sent for line manager review`,
  });

  return {
    sheet: {
      estimateId: id,
      version: sheetVersion,
      reviewStage: "in_review" as ReviewStage,
      lines: current.lines,
      submittedAt,
      submittedBy: actor,
      rates,
      summary,
    },
  };
}

export async function decideSheet(
  id: string,
  organizationId: string,
  decision: "approved" | "returned",
  actor: string,
  actorRole: string,
) {
  await ensureDb();
  // Verify org ownership
  const owned = await getEstimate(id, organizationId);
  if (!owned) return { error: "Estimate not found." as const };

  const estimateRows = await sql()`
    select workflow_step from estimates where id = ${id} and organization_id = ${organizationId} limit 1
  `;
  const workflowStep = String(estimateRows[0]?.workflow_step ?? "created");
  const requiredRole = workflowStep === "created" ? "Line Manager" : "Sales Director";
  if (actorRole !== requiredRole && actorRole !== "Admin" && actorRole !== "Super Admin") {
    return { error: `${requiredRole} must decide this step.` as const };
  }

  const currentRows = await sql()`select * from estimate_sheets where estimate_id = ${id} limit 1`;
  const current = currentRows[0] ? mapSheet(currentRows[0] as Record<string, unknown>) : null;
  const estimate = await getEstimate(id, organizationId);
  if (!current || !estimate || current.reviewStage !== "in_review") {
    return { error: "There is no estimate waiting for a decision." as const };
  }
  const isFinalApproval = decision === "approved" && workflowStep === "sales_director";
  const nextStage: ReviewStage = decision === "returned" ? "returned" : isFinalApproval ? "approved" : "in_review";
  const nextWorkflowStep = decision === "returned" ? "created" : isFinalApproval ? "final" : "sales_director";
  await sql()`
    update estimate_sheets set review_stage = ${nextStage}, updated_at = now() where estimate_id = ${id}
  `;
  await sql()`
    update estimates
    set workflow_step = ${nextWorkflowStep}, review_stage = ${nextStage},
        status = ${nextStage === "approved" ? "approved" : nextStage === "returned" ? "rejected" : "pending"},
        updated_at = now()
    where id = ${id} and organization_id = ${organizationId}
  `;
  const rates = await getExchangeRates(organizationId);
  const summary = summarizeSheet(current.lines, rates);
  await syncEstimate(id, organizationId, summary.grandTotalNgn, nextStage);
  await recordAudit({
    organizationId,
    actor,
    action: decision === "returned" ? "sheet.returned" : isFinalApproval ? "sheet.approved" : "sheet.advanced",
    estimateId: id,
    detail: decision === "approved"
      ? isFinalApproval ? "Finally approved by Sales Director" : "Approved by Line Manager; sent to Sales Director"
      : `Returned by ${actorRole}`,
  });

  return {
    sheet: {
      estimateId: id,
      version: current.version,
      reviewStage: nextStage,
      lines: current.lines,
      submittedAt: current.submittedAt,
      submittedBy: current.submittedBy,
      rates,
      summary,
    },
  };
}

export async function saveExchangeRates(
  organizationId: string,
  patch: Partial<ExchangeRateTable>,
  floatationPatch?: Partial<ExchangeFloatation>,
) {
  await ensureDb();
  const current = await getExchangeRateSettings(organizationId);
  const rates = current.rates;
  const floatation = current.floatation;
  (Object.keys(DEFAULT_RATES) as SheetCurrency[]).forEach((currency) => {
    const next = patch[currency];
    if (typeof next === "number" && Number.isFinite(next) && next > 0) rates[currency] = next;
  });
  (["USD", "EUR", "GBP"] as const).forEach((currency) => {
    const next = floatationPatch?.[currency];
    if (typeof next === "number" && Number.isFinite(next)) floatation[currency] = next;
  });
  rates.NGN = 1;
  const missing = (["USD", "EUR", "GBP"] as const).filter((currency) => rates[currency] <= 0);
  if (missing.length > 0) {
    throw new Error(`Enter a positive NGN exchange rate for ${missing.join(", ")}.`);
  }
  await sql()`
    insert into exchange_rates(organization_id, currency, rate, floatation) values
      (${organizationId}, 'NGN', ${rates.NGN}, 0),
      (${organizationId}, 'USD', ${rates.USD}, ${floatation.USD}),
      (${organizationId}, 'EUR', ${rates.EUR}, ${floatation.EUR}),
      (${organizationId}, 'GBP', ${rates.GBP}, ${floatation.GBP})
    on conflict (organization_id, currency) do update set rate = excluded.rate, floatation = excluded.floatation
  `;
  return { rates: { ...rates }, floatation: { ...floatation } };
}

export async function listClients(organizationId: string) {
  const estimates = await listEstimates(organizationId);
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

export async function listAudit(organizationId: string) {
  await ensureDb();
  const rows = await sql()`select event_ref, at, actor, role, action, estimate_id, detail from audit_events where organization_id = ${organizationId} order by at desc limit 500`;
  return rows.map((row) => ({
    id: String(row.event_ref),
    at: toIso(row.at) ?? new Date().toISOString(),
    actor: String(row.actor),
    action: String(row.action),
    estimateId: String(row.estimate_id),
    detail: String(row.detail ?? ""),
  })) as AuditEvent[];
}

export async function listReports(organizationId: string) {
  const estimates = await listEstimates(organizationId);
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

export function computeDashboardSummary(estimates: EstimateRecord[]): DashboardSummary {
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

export async function getDashboardSummary(
  organizationId: string,
  prefetched?: EstimateRecord[],
): Promise<DashboardSummary> {
  const estimates = prefetched ?? (await listEstimates(organizationId));
  return computeDashboardSummary(estimates);
}
