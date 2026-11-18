import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { encodeSession } from "@/lib/session-token";
import type { SessionUser } from "@/lib/types";
import { validateLogin } from "@/lib/validators";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    remember?: boolean;
  } | null;

  const result = validateLogin({
    email: body?.email,
    password: body?.password,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, field: result.field },
      { status: 400 },
    );
  }

  const session: SessionUser = {
    email: result.email,
    role: "Representative",
    estimateId: "EST-2026-001",
    version: "v1",
  };

  const response = NextResponse.json({ user: session });
  response.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: body?.remember ? 60 * 60 * 24 * 30 : undefined,
  });
  return response;
}
