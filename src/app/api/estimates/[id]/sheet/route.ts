import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { saveSheet, sheetResponse } from "@/lib/db";
import type { SheetLine } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const sheet = await sheetResponse(id, auth.session.organizationId, auth.session.version);
  if (!sheet) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json(sheet);
}

export async function PUT(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { lines?: Partial<SheetLine>[] } | null;
  if (!Array.isArray(body?.lines)) {
    return NextResponse.json({ error: "Send the sheet lines." }, { status: 400 });
  }

  const result = await saveSheet(id, auth.session.organizationId, body.lines, auth.session.version, auth.session.role);
  if ("error" in result) {
    const status = result.error === "Estimate not found." ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.sheet);
}
