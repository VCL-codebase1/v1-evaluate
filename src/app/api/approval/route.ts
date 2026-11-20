import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { sheetResponse } from "@/lib/db";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const sheet = await sheetResponse(auth.session.estimateId, auth.session.organizationId, auth.session.version);
  if (!sheet) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
  return NextResponse.json(sheet);
}
