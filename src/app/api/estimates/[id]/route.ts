import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { deleteEstimate, getEstimate, updateEstimate } from "@/lib/db";
import { isOrgAdmin } from "@/lib/auth/roles";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const estimate = await getEstimate(id, auth.session.organizationId);
  if (!estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json({ estimate });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const existing = await getEstimate(id, auth.session.organizationId);
  if (!existing) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  if (!isOrgAdmin(auth.session.role) && existing.ownerUserId !== auth.session.userId) {
    return NextResponse.json({ error: "You do not have access to edit this estimate." }, { status: 403 });
  }
  if (existing.reviewStage === "in_review" || existing.reviewStage === "approved") {
    return NextResponse.json({ error: "This estimate cannot be edited while it is in review or approved." }, { status: 409 });
  }
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    clientName?: string;
    remarks?: string;
  } | null;
  const estimate = await updateEstimate(id, auth.session.organizationId, {
    title: body?.title,
    clientName: body?.clientName,
    remarks: body?.remarks,
  });
  if (!estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json({ estimate });
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const existing = await getEstimate(id, auth.session.organizationId);
  if (!existing) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  if (!isOrgAdmin(auth.session.role) && existing.ownerUserId !== auth.session.userId) {
    return NextResponse.json({ error: "You do not have access to delete this estimate." }, { status: 403 });
  }
  if (existing.reviewStage === "in_review" || existing.reviewStage === "approved") {
    return NextResponse.json({ error: "This estimate cannot be deleted while it is in review or approved." }, { status: 409 });
  }
  if (!(await deleteEstimate(id, auth.session.organizationId))) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
