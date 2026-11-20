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

  return NextResponse.json({ estimates: await listEstimates(session.organizationId) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    clientName?: string;
    tenderNumber?: string;
    contact?: string;
    department?: string;
    dateReceived?: string;
    deadline?: string;
    accountManager?: string;
    originator?: string;
    description?: string;
    remarks?: string;
    attachments?: string[];
    mode?: string;
    status?: EstimateStatus;
  } | null;

  const title = body?.title?.trim() ?? "";
  const clientName = body?.clientName?.trim() ?? "";
  if (!clientName) {
    return NextResponse.json({ error: "Enter the client name.", field: "clientName" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Enter the RFQ title.", field: "title" }, { status: 400 });
  }

  const status = body?.status && STATUSES.has(body.status) ? body.status : "pending";
  const attachments = Array.isArray(body?.attachments)
    ? body.attachments.filter((name): name is string => typeof name === "string")
    : [];
  const estimate = await createEstimate({
    title,
    organizationId: session.organizationId,
    clientName,
    tenderNumber: body?.tenderNumber,
    contact: body?.contact,
    department: body?.department,
    dateReceived: body?.dateReceived,
    deadline: body?.deadline,
    accountManager: body?.accountManager,
    originator: body?.originator,
    description: body?.description,
    remarks: body?.remarks,
    attachments,
    mode: body?.mode,
    status,
  });
  return NextResponse.json({ estimate }, { status: 201 });
}
