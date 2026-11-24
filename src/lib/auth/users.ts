import { randomUUID } from "crypto";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import { isRole, type Role } from "@/lib/auth/roles";

export type DbUser = {
  id: string;
  organizationId: string;
  authUserId: string | null;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export type PublicUser = Pick<
  DbUser,
  "id" | "organizationId" | "authUserId" | "email" | "name" | "role" | "isActive" | "mustChangePassword"
> & {
  createdAt: string;
  lastLoginAt: string | null;
};

export type SessionProfile = Pick<
  DbUser,
  "id" | "organizationId" | "authUserId" | "email" | "name" | "role" | "isActive" | "mustChangePassword" | "failedLoginCount" | "lockedUntil"
> & {
  organizationName: string;
  estimateId: string;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapUser(row: Record<string, unknown>): DbUser {
  const role = String(row.role);
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? "org-default"),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    email: String(row.email),
    name: String(row.name),
    role: (isRole(role) ? role : "Representative") as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    failedLoginCount: Number(row.failed_login_count ?? 0),
    lockedUntil: toIso(row.locked_until),
    lastLoginAt: toIso(row.last_login_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function mapSessionProfile(row: Record<string, unknown>): SessionProfile {
  const role = String(row.role);
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? "org-default"),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    email: String(row.email),
    name: String(row.name),
    role: (isRole(role) ? role : "Representative") as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    failedLoginCount: Number(row.failed_login_count ?? 0),
    lockedUntil: toIso(row.locked_until),
    organizationName: String(row.organization_name ?? "Organization"),
    estimateId: row.estimate_id ? String(row.estimate_id) : "",
  };
}

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    authUserId: user.authUserId,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function findUserByEmail(email: string, organizationId?: string): Promise<DbUser | null> {
  await ensureDb();
  if (organizationId) {
    const rows = await sql()`
      select * from users where lower(email) = ${email.toLowerCase()} and organization_id = ${organizationId} limit 1
    `;
    return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
  }
  const rows = await sql()`select * from users where lower(email) = ${email.toLowerCase()} limit 1`;
  return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  await ensureDb();
  const rows = await sql()`select * from users where id = ${id} limit 1`;
  return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function getUserProfileByAuthId(authUserId: string): Promise<DbUser | null> {
  await ensureDb();
  const rows = await sql()`select * from users where auth_user_id = ${authUserId}::uuid limit 1`;
  if (rows[0]) return mapUser(rows[0] as Record<string, unknown>);

  // Fallback: link by email for pre-existing app users once (best-effort; depends on auth schema access).
  try {
    const rowsByEmail = await sql()`
      select u.* from users u
      join auth.users au on lower(u.email) = lower(au.email)
      where au.id = ${authUserId}::uuid
      limit 1
    `;
    if (!rowsByEmail[0]) return null;
    const linked = await sql()`
      update users set auth_user_id = ${authUserId}::uuid, updated_at = now()
      where id = ${String((rowsByEmail[0] as Record<string, unknown>).id)} and auth_user_id is null
      returning *
    `;
    return mapUser((linked[0] ?? rowsByEmail[0]) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getSessionProfileByAuthId(authUserId: string): Promise<SessionProfile | null> {
  await ensureDb();
  const rows = await sql()`
    select
      u.id, u.organization_id, u.auth_user_id, u.email, u.name, u.role, u.is_active, u.must_change_password, u.failed_login_count, u.locked_until,
      o.name as organization_name,
      (select e.id from estimates e where e.organization_id = u.organization_id order by e.created_at desc limit 1) as estimate_id
    from users u
    join organizations o on o.id = u.organization_id
    where u.auth_user_id = ${authUserId}::uuid
    limit 1
  `;
  if (rows[0]) return mapSessionProfile(rows[0] as Record<string, unknown>);

  // Fallback: link by email for pre-existing app users once (best-effort; depends on auth schema access).
  try {
    const rowsByEmail = await sql()`
      select u.id, o.name as organization_name
      from users u
      join organizations o on o.id = u.organization_id
      join auth.users au on lower(u.email) = lower(au.email)
      where au.id = ${authUserId}::uuid
      limit 1
    `;
    if (!rowsByEmail[0]) return null;
    await sql()`
      update users set auth_user_id = ${authUserId}::uuid, updated_at = now()
      where id = ${String((rowsByEmail[0] as Record<string, unknown>).id)} and auth_user_id is null
    `;
    const linked = await sql()`
      select
        u.id, u.organization_id, u.auth_user_id, u.email, u.name, u.role, u.is_active, u.must_change_password, u.failed_login_count, u.locked_until,
        o.name as organization_name,
        (select e.id from estimates e where e.organization_id = u.organization_id order by e.created_at desc limit 1) as estimate_id
      from users u
      join organizations o on o.id = u.organization_id
      where u.auth_user_id = ${authUserId}::uuid
      limit 1
    `;
    return linked[0] ? mapSessionProfile(linked[0] as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function listUsers(organizationId?: string): Promise<PublicUser[]> {
  await ensureDb();
  const rows = organizationId
    ? await sql()`
        select id, organization_id, auth_user_id, email, name, role, is_active, must_change_password, created_at, last_login_at
        from users
        where organization_id = ${organizationId}
        order by created_at asc
      `
    : await sql()`
        select id, organization_id, auth_user_id, email, name, role, is_active, must_change_password, created_at, last_login_at
        from users
        order by created_at asc
      `;
  return rows.map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id ?? "org-default"),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  }));
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  mustChangePassword?: boolean;
  authUserId?: string | null;
  isActive?: boolean;
}) {
  await ensureDb();
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  const organizationId = input.organizationId.trim();
  if (!organizationId) throw new Error("Organization is required.");
  if (!email || !name) throw new Error("Name and email are required.");
  if (!isRole(input.role)) throw new Error("Invalid role.");

  const existing = await findUserByEmail(email, organizationId);
  if (existing) throw new Error("A user with this email already exists in this organization.");

  const id = `usr-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const rows = await sql()`
    insert into users(
      id, organization_id, auth_user_id, email, name, role, is_active, must_change_password
    )
    values (
      ${id},
      ${organizationId},
      ${input.authUserId ? input.authUserId : null}::uuid,
      ${email},
      ${name},
      ${input.role},
      ${input.isActive ?? true},
      ${Boolean(input.mustChangePassword)}
    )
    returning id, organization_id, auth_user_id, email, name, role, is_active, must_change_password, created_at, last_login_at
  `;
  const row = rows[0];
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  } satisfies PublicUser;
}

export async function updateUserAdmin(
  id: string,
  patch: {
    role?: Role;
    isActive?: boolean;
    name?: string;
    authUserId?: string | null;
    mustChangePassword?: boolean;
  },
  organizationId?: string,
) {
  await ensureDb();
  const current = await findUserById(id);
  if (!current) return null;
  if (organizationId && current.organizationId !== organizationId) return null;

  const role = patch.role ?? current.role;
  const isActive = typeof patch.isActive === "boolean" ? patch.isActive : current.isActive;
  const name = typeof patch.name === "string" && patch.name.trim() ? patch.name.trim() : current.name;
  const authUserId = patch.authUserId !== undefined ? patch.authUserId : current.authUserId;
  const mustChangePassword =
    typeof patch.mustChangePassword === "boolean" ? patch.mustChangePassword : current.mustChangePassword;

  const rows = organizationId
    ? await sql()`
        update users set
          role = ${role},
          is_active = ${isActive},
          name = ${name},
          auth_user_id = ${authUserId}::uuid,
          must_change_password = ${mustChangePassword},
          failed_login_count = case when ${isActive} = true then 0 else failed_login_count end,
          locked_until = case when ${isActive} = true then null else locked_until end,
          updated_at = now()
        where id = ${id} and organization_id = ${organizationId}
        returning id, organization_id, auth_user_id, email, name, role, is_active, must_change_password, created_at, last_login_at
      `
    : await sql()`
        update users set
          role = ${role},
          is_active = ${isActive},
          name = ${name},
          auth_user_id = ${authUserId}::uuid,
          must_change_password = ${mustChangePassword},
          failed_login_count = case when ${isActive} = true then 0 else failed_login_count end,
          locked_until = case when ${isActive} = true then null else locked_until end,
          updated_at = now()
        where id = ${id}
        returning id, organization_id, auth_user_id, email, name, role, is_active, must_change_password, created_at, last_login_at
      `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  } satisfies PublicUser;
}

export async function ensureUserProfile(input: {
  authUserId: string;
  email: string;
  organizationId?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}): Promise<DbUser | null> {
  await ensureDb();
  const email = input.email.toLowerCase().trim();
  if (!email) return null;

  const byAuth = await getUserProfileByAuthId(input.authUserId);
  if (byAuth) return byAuth;

  const existing = await findUserByEmail(email, input.organizationId);
  if (existing) {
    const rows = await sql()`
      update users set auth_user_id = ${input.authUserId}::uuid, updated_at = now()
      where id = ${existing.id}
      returning *
    `;
    return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : existing;
  }

  // In multitenant mode we require org context to auto-create a profile safely.
  if (!input.organizationId) return null;

  const role = isRole(input.role) ? (input.role as Role) : "Representative";
  const name = (input.name || email.split("@")[0] || "User").trim();
  const id = `usr-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const rows = await sql()`
    insert into users(
      id, organization_id, auth_user_id, email, name, role, is_active, must_change_password
    )
    values (
      ${id},
      ${input.organizationId},
      ${input.authUserId}::uuid,
      ${email},
      ${name},
      ${role},
      ${input.isActive ?? true},
      ${Boolean(input.mustChangePassword)}
    )
    returning *
  `;
  return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function markLoginSuccess(userId: string) {
  await ensureDb();
  await sql()`
    update users set
      failed_login_count = 0,
      locked_until = null,
      last_login_at = now(),
      updated_at = now()
    where id = ${userId}
  `;
}

export async function markLoginFailure(userId: string, opts?: { maxFailures?: number; lockMinutes?: number }) {
  await ensureDb();
  const maxFailures = opts?.maxFailures ?? 8;
  const lockMinutes = opts?.lockMinutes ?? 15;
  await sql()`
    update users set
      failed_login_count = failed_login_count + 1,
      locked_until = case
        when failed_login_count + 1 >= ${maxFailures} then now() + (${lockMinutes} * interval '1 minute')
        else locked_until
      end,
      updated_at = now()
    where id = ${userId}
  `;
}

export async function clearPasswordState(userId: string, opts?: { mustChangePassword?: boolean; revokeRefreshTokens?: boolean }) {
  await ensureDb();
  await sql()`
    update users set
      must_change_password = ${Boolean(opts?.mustChangePassword)},
      failed_login_count = 0,
      locked_until = null,
      updated_at = now()
    where id = ${userId}
  `;
  if (opts?.revokeRefreshTokens) {
    await sql()`delete from refresh_tokens where user_id = ${userId}`;
  }
}

export function isUserLocked(user: Pick<DbUser, "lockedUntil">) {
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil).getTime() > Date.now();
}
