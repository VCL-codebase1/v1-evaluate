import postgres from "postgres";
import { resolveDatabaseConnectionUrl } from "@/lib/db/connection-url";

const globalForSql = globalThis as typeof globalThis & {
  __v11Sql?: ReturnType<typeof postgres>;
  __v11DbReady?: Promise<void>;
};

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function boolFromEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Configure it to use the Postgres database.");
  }
  return resolveDatabaseConnectionUrl(url);
}

export function sql() {
  if (!globalForSql.__v11Sql) {
    const url = connectionString();
    const supabasePooler = /\.pooler\.supabase\.com$/i.test(new URL(url).hostname);
    // Each warm function must release its session pooler connection promptly.
    const max = supabasePooler ? 1 : intFromEnv("DB_POOL_MAX", process.env.VERCEL ? 1 : 5);
    const idle_timeout = supabasePooler
      ? Math.min(intFromEnv("DB_IDLE_TIMEOUT", 5), 5)
      : intFromEnv("DB_IDLE_TIMEOUT", 20);
    const connect_timeout = supabasePooler
      ? Math.min(intFromEnv("DB_CONNECT_TIMEOUT", 5), 5)
      : intFromEnv("DB_CONNECT_TIMEOUT", 10);
    const max_lifetime = intFromEnv("DB_MAX_LIFETIME", 60 * 30);
    const prepare = boolFromEnv("DB_PREPARE", false);

    globalForSql.__v11Sql = postgres(url, {
      max,
      idle_timeout,
      connect_timeout,
      max_lifetime,
      prepare,
      ssl: supabasePooler ? "require" : undefined,
      query_timeout: intFromEnv("DB_QUERY_TIMEOUT_MS", 10000) / 1000,
      // Prevent hung queries from stalling serverless requests/functions.
      connection: {
        statement_timeout: intFromEnv("DB_STATEMENT_TIMEOUT_MS", 15000),
        idle_in_transaction_session_timeout: intFromEnv("DB_IDLE_IN_TX_TIMEOUT_MS", 15000),
      },
    });
  }
  return globalForSql.__v11Sql;
}

export function dbReady(factory: () => Promise<void>) {
  if (!globalForSql.__v11DbReady) {
    globalForSql.__v11DbReady = factory().catch((error) => {
      globalForSql.__v11DbReady = undefined;
      throw error;
    });
  }
  return globalForSql.__v11DbReady;
}
