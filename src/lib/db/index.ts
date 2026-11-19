/**
 * Workspace data access.
 * Routes talk to this module only. It currently keeps data in memory so the
 * app can run before a managed database is attached. Swap this adapter for
 * Aiven Postgres later; do not open a database connection from here yet.
 */
export {
  createEstimate,
  decideSheet,
  deleteEstimate,
  getDashboardSummary,
  getEstimate,
  getExchangeRates,
  getSheet,
  listAudit,
  listClients,
  listEstimates,
  listReports,
  recordAudit,
  saveExchangeRates,
  saveSheet,
  sheetResponse,
  submitSheet,
  updateEstimate,
} from "@/lib/db/repository";
