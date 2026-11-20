import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { submitSheet } from "@/lib/db";
import { log } from "@/lib/observability/logger";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const result = await submitSheet(id, auth.session.organizationId, auth.session.role, auth.session.version);
  if ("error" in result) {
    const status = result.error === "Estimate not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  log.info("estimate.submitted", { estimateId: id, by: auth.session.email, role: auth.session.role });
  return NextResponse.json(result.sheet);
}
