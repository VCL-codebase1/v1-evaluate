export const ROLES = ["Representative", "Line Manager", "Sales Director", "Admin", "Super Admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isOrgAdmin(role: string) {
  return role === "Admin" || role === "Super Admin";
}

export function canManageUsers(role: string) {
  return isOrgAdmin(role);
}

export function canManageExchangeRates(role: string) {
  return isOrgAdmin(role) || role === "Sales Director" || role === "Line Manager";
}

export function canDecideEstimate(role: string) {
  return isOrgAdmin(role) || role === "Sales Director" || role === "Line Manager";
}

export function canSubmitEstimate(role: string) {
  return role === "Representative" || isOrgAdmin(role);
}

export type WorkflowStep = "created" | "line_manager" | "sales_director" | "final";

/** Who may act while an estimate sits on this workflow step. */
export function roleForWorkflowStep(step: WorkflowStep): Role {
  if (step === "line_manager") return "Line Manager";
  if (step === "sales_director") return "Sales Director";
  if (step === "final") return "Sales Director";
  return "Representative";
}

export function canActOnWorkflowStep(role: string, step: WorkflowStep) {
  if (role === "Admin") return true;
  if (step === "created" || step === "final") return false;
  return role === roleForWorkflowStep(step);
}
