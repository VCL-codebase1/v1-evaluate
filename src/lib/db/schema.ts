import { dbReady, sql } from "@/lib/db/client";
import { log } from "@/lib/observability/logger";

const READY_TIMEOUT_MS = 10000;

/**
 * Ensures the database is reachable and migrations have been applied.
 * Schema changes must be made via SQL migrations in db/migrations and applied with `npm run db:migrate`.
 */
export async function ensureDb() {
  return dbReady(async () => {
    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Database readiness check timed out.")),
          READY_TIMEOUT_MS,
        );
      });
      const rows = await Promise.race([
        sql()`select 1 from schema_migrations where id = '0009_quote_analysis' limit 1`,
        timeout,
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      if (rows.length === 0) {
        throw new Error("Database migrations are not current. Run `npm run db:migrate` before starting the application.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = /schema_migrations|relation .* does not exist|migrations are not current/i.test(message)
        ? "migrations_not_current"
        : /timed out/i.test(message)
          ? "readiness_timeout"
          : "database_unavailable";
      log.error("database.readiness_failed", { reason, message });
      throw new Error("The service is temporarily unavailable. Please try again shortly.");
    }
  });
}

/** @deprecated Use ensureDb() */
export const ensureSchema = ensureDb;
