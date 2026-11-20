import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { listReports } from "@/lib/db";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  return NextResponse.json({ reports: await listReports() });
}