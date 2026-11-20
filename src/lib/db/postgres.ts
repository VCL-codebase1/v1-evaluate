import { Pool } from "pg";
import { exportBackend, replaceBackend } from "@/lib/backend/store";
import { memoryStore } from "@/lib/db/memory";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_state (
  id integer PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS api_state (
  id integer PRIMARY KEY,
  data jsonb NOT NULL
);
`;

let pool: Pool | undefined;
let workspaceReady = false;
let apiReady = false;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  pool ??= new Pool({ connectionString });
  return pool;
}

async function ensureSchema() {
  await getPool().query(SCHEMA);
}

export function postgresEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export async function hydrateWorkspace() {
  if (!postgresEnabled() || workspaceReady) return;
  await ensureSchema();
  const result = await getPool().query("SELECT data FROM workspace_state WHERE id = 1");
  const data = result.rows[0]?.data;
  if (data) {
    const store = memoryStore();
    store.estimates = data.estimates ?? [];
    store.sheets = data.sheets ?? {};
    store.rates = data.rates ?? store.rates;
    store.audit = data.audit ?? [];
  }
  workspaceReady = true;
}

export async function flushWorkspace() {
  if (!postgresEnabled()) return;
  const store = memoryStore();
  await getPool().query(
    `INSERT INTO workspace_state (id, data)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify({ estimates: store.estimates, sheets: store.sheets, rates: store.rates, audit: store.audit })],
  );
}

export async function hydrateApi() {
  if (!postgresEnabled() || apiReady) return;
  await ensureSchema();
  const result = await getPool().query("SELECT data FROM api_state WHERE id = 1");
  if (result.rows[0]?.data) replaceBackend(result.rows[0].data);
  apiReady = true;
}

export async function flushApi() {
  if (!postgresEnabled()) return;
  await getPool().query(
    `INSERT INTO api_state (id, data)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(exportBackend())],
  );
}
