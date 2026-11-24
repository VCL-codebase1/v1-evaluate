import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { getQuotation, saveQuotation, type QuotationDraft } from "@/lib/db/commercial";
import { getEstimate } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  if (!(await getEstimate(id, auth.session.organizationId))) {
    return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  }
  try {
    return NextResponse.json({ quotation: await getQuotation(auth.session.organizationId, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the quotation." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  if (!(await getEstimate(id, auth.session.organizationId))) {
    return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as Partial<QuotationDraft> | null;
  const current = await getQuotation(auth.session.organizationId, id);
  const next: QuotationDraft = {
    ...current,
    ...body,
    estimateId: id,
    issued: Array.isArray(body?.issued) ? body.issued.map(String) : current.issued,
  };
  try {
    return NextResponse.json({ quotation: await saveQuotation(auth.session.organizationId, next) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save the quotation." }, { status: 500 });
  }
}
