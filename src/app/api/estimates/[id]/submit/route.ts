import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { canSubmitEstimate, isOrgAdmin } from "@/lib/auth/roles";
import { getEstimate, submitSheet } from "@/lib/db";
import { log } from "@/lib/observability/logger";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  if (!canSubmitEstimate(auth.session.role)) {
    return NextResponse.json({ error: "You do not have access to submit estimates." }, { status: 403 });
  }

  const { id } = await context.params;
  const estimate = await getEstimate(id, auth.session.organizationId);
  if (!estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  if (!isOrgAdmin(auth.session.role) && estimate.ownerUserId !== auth.session.userId) {
    return NextResponse.json({ error: "You do not have access to submit this estimate." }, { status: 403 });
  }
  const result = await submitSheet(
    id,
    auth.session.organizationId,
    `${auth.session.name} (${auth.session.role})`,
    auth.session.version,
  );
  if ("error" in result) {
    const status = result.error === "Estimate not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  log.info("estimate.submitted", { estimateId: id, by: auth.session.email, role: auth.session.role });
  return NextResponse.json(result.sheet);
}
