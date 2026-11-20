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
