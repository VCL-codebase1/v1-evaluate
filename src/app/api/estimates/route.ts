import { NextResponse } from "next/server";
import { createEstimate, listEstimates } from "@/lib/estimates";
import { getSession } from "@/lib/session";
import type { EstimateStatus } from "@/lib/types";

const STATUSES = new Set<EstimateStatus>(["pending", "approved", "rejected"]);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  return NextResponse.json({ estimates: listEstimates() });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    mode?: string;
    status?: EstimateStatus;
  } | null;

  const title = body?.title?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "Enter an estimate title." }, { status: 400 });
  }

  const status = body?.status && STATUSES.has(body.status) ? body.status : "pending";
  const estimate = createEstimate({ title, mode: body?.mode, status });
  return NextResponse.json({ estimate }, { status: 201 });
}
