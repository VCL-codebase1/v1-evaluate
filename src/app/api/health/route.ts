import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export async function GET() {
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  let database: "ok" | "error" | "not_configured" = "not_configured";

  if (hasDatabase) {
    try {
      const migrations = await sql()`select id from schema_migrations where id = '0005_production_data_hardening' limit 1`;
      database = migrations.length > 0 ? "ok" : "error";
    } catch {
      database = "error";
    }
  }

  const supabase = hasSupabasePublicEnv() && Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  )
    ? "configured"
    : "not_configured";
  const healthy = database === "ok" && supabase === "configured";
  return NextResponse.json(
    { ok: healthy, status: healthy ? "healthy" : "degraded", checks: { database, supabase } },
    { status: healthy ? 200 : 503 },
  );
}
