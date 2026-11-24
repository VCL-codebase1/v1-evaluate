import type { ISql } from "postgres";
import { getPricingRules } from "@/lib/db/commercial";
import { priceQuoteLines } from "@/lib/quote-analysis";
import type { PricingRules } from "@/lib/commercial-types";
import { WORKFLOW_STEPS } from "@/lib/constants";
import { DEFAULT_RATES } from "@/lib/estimation";
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
    ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
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
    pricingSnapshot: row.pricing_snapshot && typeof row.pricing_snapshot === "object" ? row.pricing_snapshot as PricingRules : null,
    rateSnapshot: row.rate_snapshot && typeof row.rate_snapshot === "object" ? row.rate_snapshot as ExchangeRateTable : null,
  };
}

async function nextCounter(name: "estimate" | "audit", db: ISql = sql()) {
  await ensureDb();
  const rows = await db`
    update counters set value = value + 1 where name = ${name} returning value
  `;
  return Number(rows[0]?.value ?? 1);
}

export async function recordAudit(event: Omit<AuditEvent, "id" | "at"> & { organizationId: string }, db: ISql = sql()) {
  await ensureDb();
  const seq = await nextCounter("audit", db);
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

export async function listReviewEstimates(organizationId: string) {
  await ensureDb();
  const rows = await sql()`
    select * from estimates
    where organization_id = ${organizationId} and review_stage in ('in_review', 'approved')
    order by created_at desc
  `;
  return rows.map((row) => mapEstimate(row as Record<string, unknown>));
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
  originator: string;
  ownerUserId: string;
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
      account_manager, originator, owner_user_id, description, remarks, attachments, mode, status,
      review_stage, workflow_step, version
    ) values (
      ${id}, ${input.organizationId}, ${text(input.title)}, ${text(input.clientName)}, ${text(input.tenderNumber)},
      ${text(input.contact)}, ${text(input.department)}, ${text(input.dateReceived)}, ${text(input.deadline)},
      ${text(input.accountManager)}, ${text(input.originator)}, ${input.ownerUserId}, ${text(input.description)}, ${text(input.remarks)},
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
  patch: Partial<Pick<EstimateRecord, "title" | "clientName" | "remarks">>,
) {
  await ensureDb();
  const rows = await sql()`
    update estimates set
      title = coalesce(${patch.title == null ? null : text(patch.title)}, title),
      client_name = coalesce(${patch.clientName == null ? null : text(patch.clientName)}, client_name),
      remarks = coalesce(${patch.remarks == null ? null : text(patch.remarks)}, remarks),
      updated_at = now()
    where id = ${id} and organization_id = ${organizationId} and review_stage in ('draft', 'returned')
    returning *
  `;
  return rows[0] ? mapEstimate(rows[0] as Record<string, unknown>) : null;
}

export async function deleteEstimate(id: string, organizationId: string) {
  await ensureDb();
  const rows = await sql()`delete from estimates where id = ${id} and organization_id = ${organizationId} and review_stage in ('draft', 'returned') returning id`;
  return rows.length > 0;
}

export async function getSheet(id: string, organizationId: string, version = "v1") {
  await ensureDb();
  const rows = await sql()`
    select to_jsonb(s) as sheet
    from estimates e
    left join estimate_sheets s on s.estimate_id = e.id
    where e.id = ${id} and e.organization_id = ${organizationId}
    limit 1
  `;
  if (!rows[0]) return null;
  const sheet = rows[0].sheet;
  return sheet ? mapSheet(sheet as Record<string, unknown>) : emptySheet(id, version);
}

const EMPTY_FLOATATION: ExchangeFloatation = { USD: 0, EUR: 0, GBP: 0 };

export async function getExchangeRateSettings(organizationId: string, db: ISql = sql()): Promise<{
  rates: ExchangeRateTable;
  floatation: ExchangeFloatation;
}> {
  await ensureDb();
  const rows = await db`select currency, rate, floatation from exchange_rates where organization_id = ${organizationId}`;
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
  const [rates, rules] = await Promise.all([
    sheet.rateSnapshot ?? getExchangeRates(organizationId),
    sheet.pricingSnapshot ?? getPricingRules(organizationId),
  ]);
  return { ...sheet, rates, rules, summary: quoteSummary(sheet.lines, rates, rules) };
}

function quoteSummary(lines: SheetLine[], rates: ExchangeRateTable, rules: PricingRules) {
  const priced = priceQuoteLines(lines, rates, rules);
  return {
    lines: priced,
    itemCount: priced.filter((line) => line.item.trim()).length,
    grandTotalNgn: Math.round(priced.reduce((sum, line) => sum + line.extendedNgn, 0) * 100) / 100,
    soncapUsd: priced.reduce((sum, line) => sum + line.soncap, 0),
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
    freightType: line.freightType === "Courier" ? "Courier" : "Airport",
    installation: text(line.installation),
    applyVat: line.applyVat === true,
    applySoncap: line.applySoncap === true,
    customsRate: text(line.customsRate),
    agencyRate: text(line.agencyRate),
    shippingRate: text(line.shippingRate),
    bank1Amount: text(line.bank1Amount),
    localType: line.localType === "Purchase" ? "Purchase" : "Standard",
    soncapAmount: text(line.soncapAmount),
  };
}

function requireConfiguredRates(lines: SheetLine[], rates: ExchangeRateTable) {
  const currencies = [...new Set(lines.map((line) => line.currency))];
  const missing = currencies.filter((currency) => currency !== "NGN" && (!rates[currency] || rates[currency] <= 0));
  if (missing.length > 0) {
    throw new Error(`Configure NGN exchange rates for ${missing.join(", ")} before saving this estimate.`);
  }
}

async function lockEstimate(db: ISql, id: string, organizationId: string) {
  const rows = await db`
    select workflow_step from estimates
    where id = ${id} and organization_id = ${organizationId} for update
  `;
  return rows[0];
}

async function readSheet(db: ISql, id: string, version: string) {
  const rows = await db`select * from estimate_sheets where estimate_id = ${id}`;
  return rows[0] ? mapSheet(rows[0]) : emptySheet(id, version);
}

export async function saveSheet(
  id: string,
  organizationId: string,
  lines: Partial<SheetLine>[],
  version = "v1",
  actor = "Representative",
) {
  await ensureDb();
  const rules = await getPricingRules(organizationId);
  return sql().begin(async (db) => {
    if (!(await lockEstimate(db, id, organizationId))) return { error: "Estimate not found." as const };
    const current = await readSheet(db, id, version);
    if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
      return { error: "This estimate is locked while it is in review." as const };
    }

    const nextLines = lines
      .map((line, index) => cleanLine(line, index))
      .filter((line): line is SheetLine => Boolean(line));
    const { rates } = await getExchangeRateSettings(organizationId, db);
    requireConfiguredRates(nextLines, rates);
    const previousIds = new Set(current.lines.map((line) => line.id));
    const nextStage: ReviewStage = current.reviewStage === "returned" ? "draft" : current.reviewStage;
    const sheetVersion = current.version || version;

    await db`
      insert into estimate_sheets(estimate_id, version, review_stage, lines, submitted_at, submitted_by, pricing_snapshot, rate_snapshot, updated_at)
      values (${id}, ${sheetVersion}, ${nextStage}, ${db.json(nextLines)}::jsonb, ${current.submittedAt}, ${current.submittedBy}, ${db.json(rules)}::jsonb, ${db.json(rates)}::jsonb, now())
      on conflict (estimate_id) do update set
        version = excluded.version,
        review_stage = excluded.review_stage,
        lines = excluded.lines,
        submitted_at = excluded.submitted_at,
        submitted_by = excluded.submitted_by,
        pricing_snapshot = excluded.pricing_snapshot,
        rate_snapshot = excluded.rate_snapshot,
        updated_at = now()
    `;

    const summary = quoteSummary(nextLines, rates, rules);
    await db`
      update estimates set total_ngn = ${summary.grandTotalNgn}, review_stage = ${nextStage},
          status = 'pending', updated_at = now()
      where id = ${id} and organization_id = ${organizationId}
    `;

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
    }, db);

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
  });
}

export async function submitSheet(id: string, organizationId: string, actor: string, version = "v1") {
  await ensureDb();
  const rules = await getPricingRules(organizationId);
  return sql().begin(async (db) => {
    if (!(await lockEstimate(db, id, organizationId))) return { error: "Estimate not found." as const };
    const current = await readSheet(db, id, version);
    const effectiveRules = current.pricingSnapshot ?? rules;
    const named = current.lines.filter((line) => line.item.trim());
    if (named.length === 0) {
      return { error: "Add an item before submitting for review." as const };
    }
    if (current.reviewStage === "in_review" || current.reviewStage === "approved") {
      return { error: "This estimate has already been submitted." as const };
    }

    const { rates } = await getExchangeRateSettings(organizationId, db);
    requireConfiguredRates(named, rates);

    const submittedAt = new Date().toISOString();
    const sheetVersion = current.version || version;
    await db`
      insert into estimate_sheets(estimate_id, version, review_stage, lines, submitted_at, submitted_by, updated_at)
      values (${id}, ${sheetVersion}, ${"in_review"}, ${db.json(current.lines)}::jsonb, ${submittedAt}, ${actor}, now())
      on conflict (estimate_id) do update set
        version = excluded.version,
        review_stage = excluded.review_stage,
        submitted_at = excluded.submitted_at,
        submitted_by = excluded.submitted_by,
        updated_at = now()
    `;
    const summary = quoteSummary(current.lines, rates, effectiveRules);
    await db`
      update estimates set review_stage = 'in_review', workflow_step = 'line_manager', status = 'pending',
          total_ngn = ${summary.grandTotalNgn}, submitted_at = ${submittedAt}, submitted_by = ${actor}, updated_at = now()
      where id = ${id} and organization_id = ${organizationId}
    `;
    await recordAudit({
      organizationId,
      actor,
      action: "sheet.submitted",
      estimateId: id,
      detail: `${sheetVersion} sent for line manager review`,
    }, db);

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
  });
}

export async function decideSheet(
  id: string,
  organizationId: string,
  decision: "approved" | "returned",
  actor: string,
  actorRole: string,
) {
  await ensureDb();
  const rules = await getPricingRules(organizationId);
  return sql().begin(async (db) => {
    const estimate = await lockEstimate(db, id, organizationId);
    if (!estimate) return { error: "Estimate not found." as const };
    const workflowStep = String(estimate.workflow_step);
    const requiredRole = workflowStep !== "sales_director" ? "Line Manager" : "Sales Director";
    if (actorRole !== requiredRole && actorRole !== "Admin" && actorRole !== "Super Admin") {
      return { error: `${requiredRole} must decide this step.` as const };
    }

    const current = await readSheet(db, id, "v1");
    const effectiveRules = current.pricingSnapshot ?? rules;
    if (current.reviewStage !== "in_review") {
      return { error: "There is no estimate waiting for a decision." as const };
    }
    const isFinalApproval = decision === "approved" && workflowStep === "sales_director";
    const nextStage: ReviewStage = decision === "returned" ? "returned" : isFinalApproval ? "approved" : "in_review";
    const nextWorkflowStep = decision === "returned" ? "created" : isFinalApproval ? "final" : "sales_director";
    const { rates } = await getExchangeRateSettings(organizationId, db);
    const summary = quoteSummary(current.lines, rates, effectiveRules);
    await db`
      update estimate_sheets set review_stage = ${nextStage}, updated_at = now() where estimate_id = ${id}
    `;
    await db`
      update estimates
      set total_ngn = ${summary.grandTotalNgn}, workflow_step = ${nextWorkflowStep}, review_stage = ${nextStage},
          status = ${nextStage === "approved" ? "approved" : nextStage === "returned" ? "rejected" : "pending"},
          updated_at = now()
      where id = ${id} and organization_id = ${organizationId}
    `;
    await recordAudit({
      organizationId,
      actor,
      action: decision === "returned" ? "sheet.returned" : isFinalApproval ? "sheet.approved" : "sheet.advanced",
      estimateId: id,
      detail: decision === "approved"
        ? isFinalApproval ? "Finally approved by Sales Director" : "Approved by Line Manager; sent to Sales Director"
        : `Returned by ${actorRole}`,
    }, db);

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
  });
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
  await ensureDb();
  const rows = await sql()`
    select btrim(client_name) as name, count(*)::integer as estimates
    from estimates
    where organization_id = ${organizationId} and btrim(client_name) <> ''
    group by btrim(client_name)
    order by max(created_at) desc
  `;
  return rows.map((row) => ({ name: String(row.name), estimates: Number(row.estimates) }));
}

export async function listAudit(organizationId: string, estimateId?: string) {
  await ensureDb();
  const rows = estimateId
    ? await sql()`
        select event_ref, at, actor, role, action, estimate_id, detail
        from audit_events where organization_id = ${organizationId} and estimate_id = ${estimateId}
        order by at desc limit 500
      `
    : await sql()`
        select event_ref, at, actor, role, action, estimate_id, detail
        from audit_events where organization_id = ${organizationId}
        order by at desc limit 500
      `;
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
  await ensureDb();
  const rows = await sql()`
    select id, title, client_name, total_ngn, version
    from estimates
    where organization_id = ${organizationId} and (status = 'approved' or review_stage = 'approved')
    order by created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    clientName: String(row.client_name ?? ""),
    totalNgn: toNum(row.total_ngn),
    version: String(row.version ?? "v1"),
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
  if (prefetched) return computeDashboardSummary(prefetched);
  await ensureDb();
  const rows = await sql()`
    select
      count(*)::integer as total,
      count(*) filter (where status = 'pending')::integer as pending,
      count(*) filter (where status = 'approved')::integer as approved,
      count(*) filter (where status = 'rejected')::integer as rejected
    from estimates where organization_id = ${organizationId}
  `;
  const counts = rows[0];
  const total = Number(counts?.total ?? 0);
  return {
    steps: WORKFLOW_STEPS,
    progress: total === 0 ? 3 : 28,
    stats: [
      { key: "total", label: "Total estimates", value: total, tone: "purple" },
      { key: "pending", label: "Pending review", value: Number(counts?.pending ?? 0), tone: "orange" },
      { key: "approved", label: "Approved", value: Number(counts?.approved ?? 0), tone: "green" },
      { key: "rejected", label: "Returned / Rejected", value: Number(counts?.rejected ?? 0), tone: "red" },
    ],
  };
}
