import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { DEFAULT_RATES, summarizeSheet } from "@/lib/estimation";
import type { ExchangeRateTable, ReviewStage, SheetCurrency, SheetLine, SourceMode } from "@/lib/types";

export type ApiRole = "Representative" | "Line Manager" | "Sales Director";

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  passwordHash: string;
  passwordSalt: string;
};

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
  users: ApiUser[];
  refreshTokens: Map<string, { userId: string; exp: number }>;
  estimates: ApiEstimate[];
  sheets: Record<string, ApiSheet>;
  rates: ExchangeRateTable;
  audit: ApiAudit[];
};

const globalBackend = globalThis as typeof globalThis & { __v11Backend?: BackendState };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const passwordHash = scryptSync(password, salt, 32).toString("hex");
  return { passwordHash, passwordSalt: salt };
}

function seedUser(id: string, email: string, name: string, role: ApiRole): ApiUser {
  const password = hashPassword("Estimate123!");
  return { id, email, name, role, ...password };
}

function state(): BackendState {
  if (!globalBackend.__v11Backend) {
    globalBackend.__v11Backend = {
      users: [
        seedUser("usr-rep-1", "rep1@v11.estimate", "Rep 1", "Representative"),
        seedUser("usr-manager", "manager@v11.estimate", "Line Manager", "Line Manager"),
        seedUser("usr-director", "director@v11.estimate", "Sales Director", "Sales Director"),
      ],
      refreshTokens: new Map(),
      estimates: [],
      sheets: {},
      rates: { ...DEFAULT_RATES },
      audit: [],
    };
  }
  return globalBackend.__v11Backend;
}

export function verifyPassword(user: ApiUser, password: string) {
  const actual = Buffer.from(scryptSync(password, user.passwordSalt, 32).toString("hex"));
  const expected = Buffer.from(user.passwordHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function findUserByEmail(email: string) {
  return state().users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findUserById(id: string) {
  return state().users.find((user) => user.id === id) ?? null;
}

export function publicUser(user: ApiUser) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function saveRefreshToken(tokenId: string, userId: string, exp: number) {
  state().refreshTokens.set(tokenId, { userId, exp });
}

export function takeRefreshToken(tokenId: string) {
  const record = state().refreshTokens.get(tokenId);
  if (!record) return null;
  state().refreshTokens.delete(tokenId);
  if (record.exp < Math.floor(Date.now() / 1000)) return null;
  return record;
}

export function dropRefreshToken(tokenId: string) {
  state().refreshTokens.delete(tokenId);
}

function audit(entry: Omit<ApiAudit, "id" | "at">) {
  const store = state();
  const event: ApiAudit = {
    id: `AUD-${String(store.audit.length + 1).padStart(3, "0")}`,
    at: new Date().toISOString(),
    ...entry,
  };
  store.audit = [event, ...store.audit];
  return event;
}

export function listEstimates() {
  return state().estimates.map((estimate) => ({ ...estimate }));
}

export function getEstimate(id: string) {
  const found = state().estimates.find((estimate) => estimate.id === id);
  return found ? { ...found } : null;
}

export function createEstimate(
  input: { title: string; clientName: string; description?: string },
  actor: ApiUser,
) {
  const store = state();
  const estimate: ApiEstimate = {
    id: `EST-2026-${String(store.estimates.length + 1).padStart(3, "0")}`,
    title: input.title.trim(),
    clientName: input.clientName.trim(),
    originator: actor.name,
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
    role: actor.role,
    action: "estimate.created",
    estimateId: estimate.id,
    detail: "created",
  });
  return { ...estimate };
}

const SOURCES = new Set<SourceMode>(["Local", "Air", "Sea"]);
const CURRENCIES = new Set<SheetCurrency>(["NGN", "USD", "EUR", "GBP"]);

function cleanLine(line: Partial<SheetLine>, index: number): SheetLine | null {
  const item = line.item?.trim() ?? "";
  const qty = line.qty?.trim() ?? "";
  const base = line.base?.trim() ?? "";
  const freight = line.freight?.trim() ?? "";
  const msc = line.msc?.trim() ?? "";
  if (!item && !qty && !base && !freight && !msc) return null;
  const source = SOURCES.has(line.source as SourceMode) ? (line.source as SourceMode) : "Local";
  const currency = CURRENCIES.has(line.currency as SheetCurrency) ? (line.currency as SheetCurrency) : "NGN";
  return {
    id: line.id?.trim() || `line-${index + 1}`,
    item,
    source,
    currency,
    qty,
    base,
    freight,
    msc,
  };
}

export function getSheetView(id: string) {
  const estimate = state().estimates.find((item) => item.id === id);
  const sheet = state().sheets[id];
  if (!estimate || !sheet) return null;
  const summary = summarizeSheet(sheet.lines, state().rates);
  return {
    estimate,
    version: sheet.version,
    lines: summary.lines,
    grandTotalNgn: summary.grandTotalNgn,
    soncapUsd: summary.soncapUsd,
    rates: { ...state().rates },
    workflow: workflow(estimate),
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
        role: actor.role,
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
    role: actor.role,
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
  if (actor.role !== required) {
    return { error: `${required} must decide this step.` as const, status: 403 as const };
  }
  if (decision === "returned") {
    estimate.reviewStage = "returned";
    estimate.status = "rejected";
    estimate.workflowStep = "created";
    audit({
      actor: actor.name,
      role: actor.role,
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
      role: actor.role,
      action: "sheet.approved",
      estimateId: id,
      detail: "Finally Approved",
    });
  } else {
    estimate.workflowStep = next;
    audit({
      actor: actor.name,
      role: actor.role,
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

export function exportBackend() {
  const current = state();
  return {
    users: current.users,
    estimates: current.estimates,
    sheets: current.sheets,
    rates: current.rates,
    audit: current.audit,
    refreshTokens: [...current.refreshTokens.entries()],
  };
}

export function replaceBackend(data: {
  users: ApiUser[];
  estimates: ApiEstimate[];
  sheets: Record<string, ApiSheet>;
  rates: ExchangeRateTable;
  audit: ApiAudit[];
  refreshTokens: [string, { userId: string; exp: number }][];
}) {
  const current = state();
  current.users = data.users;
  current.estimates = data.estimates;
  current.sheets = data.sheets;
  current.rates = data.rates;
  current.audit = data.audit;
  current.refreshTokens = new Map(data.refreshTokens);
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
