import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { deleteEstimate, getEstimate, updateEstimate } from "@/lib/db";
import type { EstimateStatus } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

const STATUSES = new Set<EstimateStatus>(["pending", "approved", "rejected"]);

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
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    clientName?: string;
    remarks?: string;
    status?: EstimateStatus;
  } | null;
  const status = body?.status && STATUSES.has(body.status) ? body.status : undefined;
  const estimate = await updateEstimate(id, auth.session.organizationId, {
    title: body?.title,
    clientName: body?.clientName,
    remarks: body?.remarks,
    status,
  });
  if (!estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json({ estimate });
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  if (!(await deleteEstimate(id, auth.session.organizationId))) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
