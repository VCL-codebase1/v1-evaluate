import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/estimates";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  return NextResponse.json({
    user: session,
    ...getDashboardSummary(),
  });
}
