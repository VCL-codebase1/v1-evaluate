#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(resolve(process.cwd(), file));
      if (process.env.DATABASE_URL) return;
    } catch {
      // ignore missing or unreadable env file
    }
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Set it in the environment or .env.local before running migrations.",
  );
  process.exit(1);
}

const migrationsDir = resolve(process.cwd(), "db/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => /^\d+.*\.sql$/.test(f))
  .sort();

if (files.length === 0) {
  console.log("No migration files found in db/migrations.");
  process.exit(0);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  prepare: false,
});

async function ensureMigrationsTable() {
  await sql.unsafe(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function appliedIds() {
  const rows = await sql`select id from schema_migrations order by id`;
  return new Set(rows.map((r) => String(r.id)));
}

async function run() {
  await ensureMigrationsTable();
  const applied = await appliedIds();
  let count = 0;

  for (const file of files) {
    const id = file.replace(/\.sql$/i, "");
    if (applied.has(id)) {
      console.log(`skip  ${id} (already applied)`);
      continue;
    }

    const body = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`apply ${id} ...`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations(id) values (${id}) on conflict (id) do nothing`;
    });
    console.log(`done  ${id}`);
    count += 1;
  }

  if (count === 0) {
    console.log("Database is up to date. No migrations applied.");
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
}

try {
  await run();
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
