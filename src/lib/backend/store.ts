import { summarizeSheet } from "@/lib/estimation";
import {
  createEstimate as createWorkspaceEstimate,
  decideSheet,
  getEstimate as getWorkspaceEstimate,
  getExchangeRates,
  getSheet,
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
  const [estimate, sheet, rates] = await Promise.all([
    getEstimate(id, organizationId),
    getSheet(id, organizationId),
    getExchangeRates(organizationId),
  ]);
  if (!estimate || !sheet) return null;
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
  return submitSheet(id, actor.organizationId, actor.name, "v1");
}

export async function decideEstimate(id: string, decision: "approved" | "returned", actor: ApiUser) {
  return decideSheet(id, actor.organizationId, decision, actor.name, actor.role);
}

export async function listAudit(organizationId: string, estimateId?: string) {
  const events = await listWorkspaceAudit(organizationId);
  return events.filter((event) => !estimateId || event.estimateId === estimateId);
}

<<<<<<< Updated upstream
export async function getRates(organizationId: string) {
  return getExchangeRates(organizationId);
=======
const NEXT_STEP: Record<WorkflowStep, WorkflowStep | null> = {
  created: "line_manager",
  line_manager: "sales_director",
  sales_director: "final",
  final: null,
};

const ROLE_FOR_STEP: Record<WorkflowStep, ApiRole> = {
  created: "Line Manager",
  line_manager: "Line Manager",
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
>>>>>>> Stashed changes
}

export async function saveRates(organizationId: string, patch: Partial<ExchangeRateTable>) {
  return saveExchangeRates(organizationId, patch);
}

export async function listClients(organizationId: string) {
  return listWorkspaceClients(organizationId);
}

export async function listReports(organizationId: string) {
  return listWorkspaceReports(organizationId);
}

export async function dashboard(organizationId: string) {
  const estimates = await listWorkspaceEstimates(organizationId);
  return {
    total: estimates.length,
    pending: estimates.filter((estimate) => estimate.status === "pending").length,
    approved: estimates.filter((estimate) => estimate.status === "approved").length,
    rejected: estimates.filter((estimate) => estimate.status === "rejected").length,
  };
}
