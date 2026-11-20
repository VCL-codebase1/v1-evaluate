/**
 * Workspace data access. When DATABASE_URL is set, each call loads and
 * writes PostgreSQL. Otherwise the in-memory store is used.
 */
import * as memory from "@/lib/db/repository";
import { flushWorkspace, hydrateWorkspace, postgresEnabled } from "@/lib/db/postgres";

async function use<T>(fn: () => T): Promise<T> {
  if (postgresEnabled()) await hydrateWorkspace();
  const result = fn();
  if (postgresEnabled()) await flushWorkspace();
  return result;
}

export const listEstimates = () => use(() => memory.listEstimates());
export const getEstimate = (id: string) => use(() => memory.getEstimate(id));
export const createEstimate = (input: Parameters<typeof memory.createEstimate>[0]) =>
  use(() => memory.createEstimate(input));
export const updateEstimate = (id: string, patch: Parameters<typeof memory.updateEstimate>[1]) =>
  use(() => memory.updateEstimate(id, patch));
export const deleteEstimate = (id: string) => use(() => memory.deleteEstimate(id));
export const getSheet = (id: string, version?: string) => use(() => memory.getSheet(id, version));
export const sheetResponse = (id: string, version?: string) => use(() => memory.sheetResponse(id, version));
export const saveSheet = (
  id: string,
  lines: Parameters<typeof memory.saveSheet>[1],
  version?: string,
  actor?: string,
) => use(() => memory.saveSheet(id, lines, version, actor));
export const submitSheet = (id: string, actor: string, version?: string) =>
  use(() => memory.submitSheet(id, actor, version));
export const decideSheet = (id: string, decision: "approved" | "returned", actor: string) =>
  use(() => memory.decideSheet(id, decision, actor));
export const getExchangeRates = () => use(() => memory.getExchangeRates());
export const saveExchangeRates = (patch: Parameters<typeof memory.saveExchangeRates>[0]) =>
  use(() => memory.saveExchangeRates(patch));
export const listClients = () => use(() => memory.listClients());
export const listAudit = () => use(() => memory.listAudit());
export const listReports = () => use(() => memory.listReports());
export const recordAudit = (event: Parameters<typeof memory.recordAudit>[0]) => use(() => memory.recordAudit(event));
export const getDashboardSummary = () => use(() => memory.getDashboardSummary());
