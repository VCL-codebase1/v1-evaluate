import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { saveSheet, sheetResponse } from "@/lib/db";
import type { SheetLine } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  return NextResponse.json(sheetResponse(id, auth.session.version));
}

export async function PUT(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { lines?: Partial<SheetLine>[] } | null;
  if (!Array.isArray(body?.lines)) {
    return NextResponse.json({ error: "Send the sheet lines." }, { status: 400 });
  }

  const result = saveSheet(id, body.lines, auth.session.version, auth.session.role);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.sheet);
}
