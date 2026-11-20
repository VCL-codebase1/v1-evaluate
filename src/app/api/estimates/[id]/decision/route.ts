import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { decideSheet } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { decision?: "approved" | "returned" } | null;
  if (body?.decision !== "approved" && body?.decision !== "returned") {
    return NextResponse.json({ error: "Choose approved or returned." }, { status: 400 });
  }

  const result = await decideSheet(id, body.decision, auth.session.role);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.sheet);
}
