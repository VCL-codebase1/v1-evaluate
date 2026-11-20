import postgres from "postgres";

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
  return url;
}

export function sql() {
  if (!globalForSql.__v11Sql) {
    // Serverless runtimes benefit from small pools; long-lived servers can raise DB_POOL_MAX.
    // When using transaction poolers (e.g. Supabase :6543), keep DB_PREPARE=false.
    const max = intFromEnv("DB_POOL_MAX", process.env.VERCEL ? 1 : 5);
    const idle_timeout = intFromEnv("DB_IDLE_TIMEOUT", 20);
    const connect_timeout = intFromEnv("DB_CONNECT_TIMEOUT", 10);
    const max_lifetime = intFromEnv("DB_MAX_LIFETIME", 60 * 30);
    const prepare = boolFromEnv("DB_PREPARE", false);

    globalForSql.__v11Sql = postgres(connectionString(), {
      max,
      idle_timeout,
      connect_timeout,
      max_lifetime,
      prepare,
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
