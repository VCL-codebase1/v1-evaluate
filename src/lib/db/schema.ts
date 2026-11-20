import { dbReady, sql } from "@/lib/db/client";

/**
 * Ensures the database is reachable and migrations have been applied.
 * Schema changes must be made via SQL migrations in db/migrations and applied with `npm run db:migrate`.
 */
export async function ensureDb() {
  return dbReady(async () => {
    try {
      await sql()`select 1 from schema_migrations limit 1`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/schema_migrations|relation .* does not exist/i.test(message)) {
        throw new Error(
          "Database schema is not initialized. Run `npm run db:migrate` before starting the application.",
        );
      }
      throw new Error(`Database is unavailable: ${message}`);
    }
  });
}

/** @deprecated Use ensureDb() */
export const ensureSchema = ensureDb;
