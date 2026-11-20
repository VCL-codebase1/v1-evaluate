import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageUsers, isRole } from "@/lib/auth/roles";
import { createUser, listUsers } from "@/lib/auth/users";
import { log } from "@/lib/observability/logger";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
    mustChangePassword?: boolean;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email.", field: "email" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Enter a name.", field: "name" }, { status: 400 });
  if (!isRole(role)) return NextResponse.json({ error: "Select a valid role.", field: "role" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters.", field: "password" }, { status: 400 });
  }

  try {
    const user = await createUser({
      email,
      name,
      role,
      password,
      mustChangePassword: body?.mustChangePassword ?? true,
    });
    log.info("admin.user.created", { by: session.email, userId: user.id, role: user.role });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
