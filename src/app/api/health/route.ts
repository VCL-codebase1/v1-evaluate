import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET() {
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  let database: "ok" | "error" | "not_configured" = "not_configured";

  if (hasDatabase) {
    try {
      await sql()`select 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const healthy = database !== "error";
  return NextResponse.json(
    { ok: healthy, status: healthy ? "healthy" : "degraded", checks: { database } },
    { status: healthy ? 200 : 503 },
  );
}