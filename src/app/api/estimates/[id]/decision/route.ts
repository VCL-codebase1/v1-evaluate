import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { decideSheet } from "@/lib/db";
import { canDecideEstimate } from "@/lib/auth/roles";
import { log } from "@/lib/observability/logger";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  if (!canDecideEstimate(auth.session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { decision?: "approved" | "returned" } | null;
  if (body?.decision !== "approved" && body?.decision !== "returned") {
    return NextResponse.json({ error: "Choose approved or returned." }, { status: 400 });
  }

  const result = await decideSheet(id, auth.session.organizationId, body.decision, auth.session.role);
  if ("error" in result) {
    const status = result.error === "Estimate not found." ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  log.info("estimate.decision", { estimateId: id, decision: body.decision, by: auth.session.email, role: auth.session.role });
  return NextResponse.json(result.sheet);
}
