import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Contact your organization's Super Admin to reset your password." },
    { status: 403 },
  );
}
