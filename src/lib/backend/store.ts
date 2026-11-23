import {
  createEstimate as createWorkspaceEstimate,
  decideSheet,
  getEstimate as getWorkspaceEstimate,
  getExchangeRates,
  sheetResponse,
  listAudit as listWorkspaceAudit,
  listClients as listWorkspaceClients,
  listEstimates as listWorkspaceEstimates,
  listReports as listWorkspaceReports,
  saveExchangeRates,
  saveSheet as saveWorkspaceSheet,
  submitSheet,
} from "@/lib/db";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import {
  findUserByEmail as dbFindUserByEmail,
  findUserById as dbFindUserById,
  toPublicUser,
  type DbUser,
} from "@/lib/auth/users";
import type { ExchangeRateTable, ReviewStage, SheetLine } from "@/lib/types";

export type ApiRole = "Representative" | "Line Manager" | "Sales Director" | "Admin" | "Super Admin";
export type ApiUser = DbUser;
export type WorkflowStep = "created" | "line_manager" | "sales_director" | "final";
export type ApiEstimate = {
  id: string;
  title: string;
  clientName: string;
  originator: string;
  ownerUserId: string | null;
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

function toApiEstimate(estimate: NonNullable<Awaited<ReturnType<typeof getWorkspaceEstimate>>>): ApiEstimate {
  const storedStep = estimate.workflowStep;
  const workflowStep: WorkflowStep = storedStep === "sales_director" || storedStep === "final" || storedStep === "line_manager"
    ? storedStep
    : estimate.reviewStage === "approved" ? "final" : "created";
  return {
    id: estimate.id,
    title: estimate.title,
    clientName: estimate.clientName,
    originator: estimate.originator,
    ownerUserId: estimate.ownerUserId,
    description: estimate.description,
    status: estimate.status,
    reviewStage: estimate.reviewStage,
    workflowStep,
    version: estimate.version,
    totalNgn: estimate.totalNgn,
    createdAt: estimate.createdAt,
    submittedAt: estimate.submittedAt,
    submittedBy: estimate.submittedBy,
  };
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

export async function listEstimates(organizationId: string) {
  return (await listWorkspaceEstimates(organizationId)).map((estimate) => toApiEstimate(estimate));
}

export async function getEstimate(id: string, organizationId: string) {
  const estimate = await getWorkspaceEstimate(id, organizationId);
  return estimate ? toApiEstimate(estimate) : null;
}

export async function createEstimate(
  input: { title: string; clientName: string; description?: string },
  actor: ApiUser,
) {
  const estimate = await createWorkspaceEstimate({
    ...input,
    organizationId: actor.organizationId,
    originator: actor.name,
    ownerUserId: actor.id,
  });
  return toApiEstimate(estimate);
}

const workflow = (estimate: ApiEstimate) => {
  const steps: { key: WorkflowStep; label: string }[] = [
    { key: "created", label: "Estimate Created" },
    { key: "line_manager", label: "Approved by Line Manager" },
    { key: "sales_director", label: "Approved by Sales Director" },
    { key: "final", label: "Finally Approved" },
  ];
  const index = steps.findIndex((step) => step.key === estimate.workflowStep);
  return steps.map((step, i) => ({
    ...step,
    state: i < index ? "complete" : i === index ? "current" : "upcoming",
  }));
};

export async function getSheetView(id: string, organizationId: string) {
  const [estimate, sheet] = await Promise.all([
    getEstimate(id, organizationId),
    sheetResponse(id, organizationId),
  ]);
  if (!estimate || !sheet) return null;
  const summary = sheet.summary;
  const rates = sheet.rates;
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
    reviewStage: sheet.reviewStage,
    workflow: workflow(estimate),
    submittedAt: sheet.submittedAt,
    submittedBy: sheet.submittedBy,
  };
}

export async function saveSheet(id: string, lines: Partial<SheetLine>[], actor: ApiUser) {
  return saveWorkspaceSheet(id, actor.organizationId, lines, "v1", actor.name);
}

export async function submitEstimate(id: string, actor: ApiUser) {
  return submitSheet(id, actor.organizationId, actor.email, "v1");
}

export async function decideEstimate(id: string, decision: "approved" | "returned", actor: ApiUser) {
  return decideSheet(id, actor.organizationId, decision, actor.name, actor.role);
}

export async function listAudit(organizationId: string, estimateId?: string) {
  const events = await listWorkspaceAudit(organizationId);
  return events.filter((event) => !estimateId || event.estimateId === estimateId);
}

export async function getRates(organizationId: string) {
  return getExchangeRates(organizationId);
}

export async function saveRates(
  organizationId: string,
  patch: Partial<ExchangeRateTable>,
  floatation?: Partial<import("@/lib/types").ExchangeFloatation>,
) {
  const saved = await saveExchangeRates(organizationId, patch, floatation);
  return saved.rates;
}

export async function listClients(organizationId: string) {
  return listWorkspaceClients(organizationId);
}

export async function listReports(organizationId: string) {
  return listWorkspaceReports(organizationId);
}

export {
  addDirectory,
  getPricingRules,
  getQuotation,
  importDirectory,
  listDirectory,
  savePricingRules,
  saveQuotation,
} from "@/lib/db/commercial";

export async function dashboard(organizationId: string) {
  const estimates = await listWorkspaceEstimates(organizationId);
  return {
    total: estimates.length,
    pending: estimates.filter((estimate) => estimate.status === "pending").length,
    approved: estimates.filter((estimate) => estimate.status === "approved").length,
    rejected: estimates.filter((estimate) => estimate.status === "rejected").length,
  };
}
