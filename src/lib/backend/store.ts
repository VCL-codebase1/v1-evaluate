import { DEFAULT_RATES, summarizeSheet } from "@/lib/estimation";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import {
  findUserByEmail as dbFindUserByEmail,
  findUserById as dbFindUserById,
  verifyUserPassword,
  toPublicUser,
  type DbUser,
} from "@/lib/auth/users";
import type { ExchangeRateTable, ReviewStage, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";

export type ApiRole = "Representative" | "Line Manager" | "Sales Director" | "Admin";

export type ApiUser = DbUser;

export type WorkflowStep = "created" | "line_manager" | "sales_director" | "final";

export type ApiEstimate = {
  id: string;
  title: string;
  clientName: string;
  originator: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  reviewStage: ReviewStage;
  workflowStep: WorkflowStep;
  version: string;
  totalNgn: number | null;
  createdAt: string;
  submittedAt: string | null;
  submittedBy: string | null;
};

export type ApiSheet = {
  estimateId: string;
  version: string;
  lines: SheetLine[];
};

export type ApiAudit = {
  id: string;
  at: string;
  actor: string;
  role: ApiRole;
  action: string;
  estimateId: string;
  detail: string;
};

type BackendState = {
  estimates: ApiEstimate[];
  sheets: Record<string, ApiSheet>;
  rates: ExchangeRateTable;
  audit: ApiAudit[];
};

const globalBackend = globalThis as typeof globalThis & { __v11Backend?: BackendState };

function state(): BackendState {
  if (!globalBackend.__v11Backend) {
    globalBackend.__v11Backend = {
      estimates: [],
      sheets: {},
      rates: { ...DEFAULT_RATES },
      audit: [],
    };
  }
  return globalBackend.__v11Backend;
}

export function verifyPassword(user: ApiUser, password: string) {
  return verifyUserPassword(user, password);
}

export async function findUserByEmail(email: string): Promise<ApiUser | null> {
  return dbFindUserByEmail(email);
}

export async function findUserById(id: string): Promise<ApiUser | null> {
  return dbFindUserById(id);
}

export function publicUser(user: ApiUser) {
  return toPublicUser(user);
}

export async function saveRefreshToken(tokenId: string, userId: string, exp: number) {
  await ensureDb();
  await sql()`
    insert into refresh_tokens(token_id, user_id, expires_at)
    values (${tokenId}, ${userId}, ${new Date(exp * 1000).toISOString()})
    on conflict (token_id) do update set user_id = excluded.user_id, expires_at = excluded.expires_at
  `;
}

export async function takeRefreshToken(tokenId: string) {
  await ensureDb();
  const rows = await sql()`
    delete from refresh_tokens where token_id = ${tokenId}
    returning user_id, extract(epoch from expires_at)::bigint as exp
  `;
  const row = rows[0] as { user_id?: string; exp?: number } | undefined;
  if (!row?.user_id) return null;
  const exp = Number(row.exp ?? 0);
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return { userId: String(row.user_id), exp };
}

export async function dropRefreshToken(tokenId: string) {
  await ensureDb();
  await sql()`delete from refresh_tokens where token_id = ${tokenId}`;
}

// --- v1 API in-memory domain store (separate from workspace Postgres data) ---
// NOTE: domain operations remain in-memory and are not unified with workspace Postgres data.

function audit(event: Omit<ApiAudit, "id" | "at">) {
  const store = state();
  const item: ApiAudit = {
    id: `AUD-${String(store.audit.length + 1).padStart(3, "0")}`,
    at: new Date().toISOString(),
    ...event,
  };
  store.audit = [item, ...store.audit];
  return item;
}

function makeId(store: BackendState) {
  return `EST-2026-${String(store.estimates.length + 1).padStart(3, "0")}`;
}

export function listEstimates() {
  return state().estimates.map((estimate) => ({ ...estimate }));
}

export function getEstimate(id: string) {
  return state().estimates.find((estimate) => estimate.id === id) ?? null;
}

export function createEstimate(
  input: { title: string; clientName: string; description?: string },
  actor: ApiUser,
) {
  const store = state();
  const estimate: ApiEstimate = {
    id: makeId(store),
    title: input.title.trim(),
    clientName: input.clientName.trim(),
    originator: actor.name || actor.role,
    description: input.description?.trim() ?? "",
    status: "pending",
    reviewStage: "draft",
    workflowStep: "created",
    version: "v1",
    totalNgn: null,
    createdAt: new Date().toISOString(),
    submittedAt: null,
    submittedBy: null,
  };
  store.estimates = [estimate, ...store.estimates];
  store.sheets[estimate.id] = { estimateId: estimate.id, version: "v1", lines: [] };
  audit({
    actor: actor.name,
    role: actor.role as ApiRole,
    action: "estimate.created",
    estimateId: estimate.id,
    detail: estimate.title,
  });
  return { ...estimate };
}

export function getSheetView(id: string) {
  const estimate = getEstimate(id);
  const sheet = state().sheets[id];
  if (!estimate || !sheet) return null;
  const rates = state().rates;
  const summary = summarizeSheet(sheet.lines, rates);
  return {
    estimateId: id,
    version: sheet.version,
    lines: summary.lines,
    summary: {
      itemCount: summary.itemCount,
      grandTotalNgn: summary.grandTotalNgn,
      soncapUsd: summary.soncapUsd,
    },
    rates,
    reviewStage: estimate.reviewStage,
    workflow: workflow(estimate),
    submittedAt: estimate.submittedAt,
    submittedBy: estimate.submittedBy,
  };
}

export function workflow(estimate: ApiEstimate) {
  const order: WorkflowStep[] = ["created", "line_manager", "sales_director", "final"];
  const labels = [
    "Estimate Created",
    "Approved by Line Manager",
    "Approved by Sales Director",
    "Finally Approved",
  ];
  const index = order.indexOf(estimate.workflowStep);
  return order.map((key, stepIndex) => ({
    key,
    label: labels[stepIndex],
    state: stepIndex < index ? "complete" : stepIndex === index ? "current" : "upcoming",
  }));
}

const SOURCES = new Set<SourceMode>(["Local", "Air", "Sea"]);
const CURRENCIES = new Set<SheetCurrency>(["NGN", "USD", "EUR", "GBP"]);

function cleanLine(line: Partial<SheetLine>, index: number): SheetLine {
  return {
    id: typeof line.id === "string" && line.id ? line.id : `line-${index + 1}`,
    item: typeof line.item === "string" ? line.item.trim() : "",
    source: SOURCES.has(line.source as SourceMode) ? (line.source as SourceMode) : "Local",
    currency: CURRENCIES.has(line.currency as SheetCurrency) ? (line.currency as SheetCurrency) : "NGN",
    qty: typeof line.qty === "string" ? line.qty : "",
    base: typeof line.base === "string" ? line.base : "",
    freight: typeof line.freight === "string" ? line.freight : "",
    msc: typeof line.msc === "string" ? line.msc : "",
  };
}

export function saveSheet(id: string, lines: Partial<SheetLine>[], actor: ApiUser) {
  const store = state();
  const estimate = store.estimates.find((item) => item.id === id);
  const sheet = store.sheets[id];
  if (!estimate || !sheet) return { error: "Estimate not found." as const, status: 404 as const };
  if (estimate.reviewStage === "in_review" || estimate.reviewStage === "approved") {
    return { error: "This estimate is locked while it is in review." as const, status: 409 as const };
  }
  const previous = new Set(sheet.lines.map((line) => line.id));
  const next = lines.map(cleanLine).filter((line): line is SheetLine => Boolean(line));
  sheet.lines = next;
  const summary = summarizeSheet(next, store.rates);
  estimate.totalNgn = summary.grandTotalNgn;
  estimate.reviewStage = estimate.reviewStage === "returned" ? "draft" : estimate.reviewStage;
  next
    .filter((line) => line.item.trim() && !previous.has(line.id))
    .forEach(() => {
      audit({
        actor: actor.name,
        role: actor.role as ApiRole,
        action: "item.added",
        estimateId: id,
        detail: "Item added",
      });
    });
  return { sheet: getSheetView(id) };
}

export function submitEstimate(id: string, actor: ApiUser) {
  const store = state();
  const estimate = store.estimates.find((item) => item.id === id);
  const sheet = store.sheets[id];
  if (!estimate || !sheet) return { error: "Estimate not found." as const, status: 404 as const };
  if (!sheet.lines.some((line) => line.item.trim())) {
    return { error: "Add an item before submitting for review." as const, status: 400 as const };
  }
  if (estimate.reviewStage === "in_review" || estimate.reviewStage === "approved") {
    return { error: "This estimate has already been submitted." as const, status: 409 as const };
  }
  estimate.reviewStage = "in_review";
  estimate.workflowStep = "created";
  estimate.status = "pending";
  estimate.submittedAt = new Date().toISOString();
  estimate.submittedBy = actor.name;
  estimate.totalNgn = summarizeSheet(sheet.lines, store.rates).grandTotalNgn;
  audit({
    actor: actor.name,
    role: actor.role as ApiRole,
    action: "sheet.submitted",
    estimateId: id,
    detail: "Submitted for Line Manager review",
  });
  return { sheet: getSheetView(id) };
}

const NEXT_STEP: Record<WorkflowStep, WorkflowStep | null> = {
  created: "line_manager",
  line_manager: "sales_director",
  sales_director: "final",
  final: null,
};

const ROLE_FOR_STEP: Record<WorkflowStep, ApiRole> = {
  created: "Line Manager",
  line_manager: "Sales Director",
  sales_director: "Sales Director",
  final: "Sales Director",
};

export function decideEstimate(id: string, decision: "approved" | "returned", actor: ApiUser) {
  const estimate = state().estimates.find((item) => item.id === id);
  if (!estimate || estimate.reviewStage !== "in_review") {
    return { error: "There is no estimate waiting for a decision." as const, status: 409 as const };
  }
  const required = ROLE_FOR_STEP[estimate.workflowStep];
  if (actor.role !== required && actor.role !== "Admin") {
    return { error: `${required} must decide this step.` as const, status: 403 as const };
  }
  if (decision === "returned") {
    estimate.reviewStage = "returned";
    estimate.status = "rejected";
    estimate.workflowStep = "created";
    audit({
      actor: actor.name,
      role: actor.role as ApiRole,
      action: "sheet.returned",
      estimateId: id,
      detail: "Returned",
    });
    return { sheet: getSheetView(id) };
  }
  const next = NEXT_STEP[estimate.workflowStep];
  if (!next || next === "final") {
    estimate.workflowStep = "final";
    estimate.reviewStage = "approved";
    estimate.status = "approved";
    audit({
      actor: actor.name,
      role: actor.role as ApiRole,
      action: "sheet.approved",
      estimateId: id,
      detail: "Finally Approved",
    });
  } else {
    estimate.workflowStep = next;
    audit({
      actor: actor.name,
      role: actor.role as ApiRole,
      action: "sheet.advanced",
      estimateId: id,
      detail: `Moved to ${next.replaceAll("_", " ")}`,
    });
  }
  return { sheet: getSheetView(id) };
}

export function listAudit(estimateId?: string) {
  return state()
    .audit.filter((event) => !estimateId || event.estimateId === estimateId)
    .map((event) => ({ ...event }));
}

export function getRates() {
  return { ...state().rates };
}

export function saveRates(patch: Partial<ExchangeRateTable>) {
  const rates = getRates();
  (Object.keys(DEFAULT_RATES) as SheetCurrency[]).forEach((currency) => {
    const next = patch[currency];
    if (typeof next === "number" && Number.isFinite(next) && next > 0) rates[currency] = next;
  });
  rates.NGN = 1;
  state().rates = rates;
  return { ...rates };
}

export function listClients() {
  const clients = new Map<string, number>();
  for (const estimate of state().estimates) {
    if (!estimate.clientName) continue;
    clients.set(estimate.clientName, (clients.get(estimate.clientName) ?? 0) + 1);
  }
  return [...clients.entries()].map(([name, estimates]) => ({ name, estimates }));
}

export function listReports() {
  return state()
    .estimates.filter((estimate) => estimate.reviewStage === "approved")
    .map((estimate) => ({
      id: estimate.id,
      title: estimate.title,
      clientName: estimate.clientName,
      totalNgn: estimate.totalNgn,
      version: estimate.version,
    }));
}

export function dashboard() {
  const estimates = state().estimates;
  return {
    total: estimates.length,
    pending: estimates.filter((estimate) => estimate.status === "pending").length,
    approved: estimates.filter((estimate) => estimate.status === "approved").length,
    rejected: estimates.filter((estimate) => estimate.status === "rejected").length,
  };
}
