import { randomUUID } from "crypto";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import { hashPassword, verifyPasswordHash } from "@/lib/security/password";
import { isRole, type Role } from "@/lib/auth/roles";

export type DbUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

export type PublicUser = Pick<DbUser, "id" | "email" | "name" | "role" | "isActive" | "mustChangePassword"> & {
  createdAt: string;
  lastLoginAt: string | null;
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
    email: String(row.email),
    name: String(row.name),
    role: (isRole(role) ? role : "Representative") as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    failedLoginCount: Number(row.failed_login_count ?? 0),
    lockedUntil: toIso(row.locked_until),
    lastLoginAt: toIso(row.last_login_at),
    passwordHash: String(row.password_hash),
    passwordSalt: String(row.password_salt),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function verifyUserPassword(user: DbUser, password: string) {
  return verifyPasswordHash(password, user.passwordHash, user.passwordSalt);
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  await ensureDb();
  const rows = await sql()`select * from users where lower(email) = lower(${email.trim()}) limit 1`;
  return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  await ensureDb();
  const rows = await sql()`select * from users where id = ${id} limit 1`;
  return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function listUsers(): Promise<PublicUser[]> {
  await ensureDb();
  const rows = await sql()`
    select id, email, name, role, is_active, must_change_password, created_at, last_login_at
    from users order by created_at asc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: (isRole(String(row.role)) ? (String(row.role) as Role) : "Representative"),
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  }));
}

export async function countUsers() {
  await ensureDb();
  const rows = await sql()`select count(*)::int as c from users`;
  return Number(rows[0]?.c ?? 0);
}

export async function createUser(input: { email: string; name: string; role: Role; password: string; mustChangePassword?: boolean }) {
  await ensureDb();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name || !isRole(input.role)) throw new Error("Invalid user data.");
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("A user with this email already exists.");
  const id = `usr-${randomUUID()}`;
  const { passwordHash, passwordSalt } = hashPassword(input.password);
  const rows = await sql()`
    insert into users(id, email, name, role, password_hash, password_salt, is_active, must_change_password)
    values (${id}, ${email}, ${name}, ${input.role}, ${passwordHash}, ${passwordSalt}, true, ${Boolean(input.mustChangePassword)})
    returning id, email, name, role, is_active, must_change_password, created_at, last_login_at
  `;
  const row = rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  } as PublicUser;
}

export async function updateUserAdmin(
  id: string,
  patch: { role?: Role; isActive?: boolean; name?: string; resetPassword?: string; mustChangePassword?: boolean },
) {
  await ensureDb();
  const current = await findUserById(id);
  if (!current) return null;
  const role = patch.role && isRole(patch.role) ? patch.role : current.role;
  const isActive = typeof patch.isActive === "boolean" ? patch.isActive : current.isActive;
  const name = typeof patch.name === "string" && patch.name.trim() ? patch.name.trim() : current.name;
  let passwordHash = current.passwordHash;
  let passwordSalt = current.passwordSalt;
  let mustChangePassword = typeof patch.mustChangePassword === "boolean" ? patch.mustChangePassword : current.mustChangePassword;
  if (typeof patch.resetPassword === "string" && patch.resetPassword.length >= 8) {
    const hashed = hashPassword(patch.resetPassword);
    passwordHash = hashed.passwordHash;
    passwordSalt = hashed.passwordSalt;
    mustChangePassword = true;
  }
  const rows = await sql()`
    update users set
      role = ${role},
      is_active = ${isActive},
      name = ${name},
      password_hash = ${passwordHash},
      password_salt = ${passwordSalt},
      must_change_password = ${mustChangePassword},
      failed_login_count = case when ${isActive} then failed_login_count else 0 end,
      locked_until = case when ${isActive} then locked_until else null end,
      updated_at = now()
    where id = ${id}
    returning id, email, name, role, is_active, must_change_password, created_at, last_login_at
  `;
  if (!rows[0]) return null;
  if (!isActive || (typeof patch.resetPassword === "string" && patch.resetPassword.length >= 8)) {
    await sql()`delete from refresh_tokens where user_id = ${id}`;
  }
  const row = rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  } as PublicUser;
}

export async function markLoginSuccess(userId: string) {
  await ensureDb();
  await sql()`
    update users set failed_login_count = 0, locked_until = null, last_login_at = now(), updated_at = now()
    where id = ${userId}
  `;
}

export async function markLoginFailure(userId: string, maxFailures = 10, lockMinutes = 15) {
  await ensureDb();
  const rows = await sql()`
    update users set
      failed_login_count = failed_login_count + 1,
      locked_until = case
        when failed_login_count + 1 >= ${maxFailures} then now() + (${lockMinutes} * interval '1 minute')
        else locked_until
      end,
      updated_at = now()
    where id = ${userId}
    returning failed_login_count, locked_until
  `;
  const row = rows[0] as { failed_login_count?: number; locked_until?: unknown } | undefined;
  return {
    failedLoginCount: Number(row?.failed_login_count ?? 0),
    lockedUntil: toIso(row?.locked_until),
  };
}

export function isUserLocked(user: Pick<DbUser, "lockedUntil" | "isActive">) {
  if (!user.isActive) return true;
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function setPassword(userId: string, password: string, opts?: { mustChangePassword?: boolean; revokeRefreshTokens?: boolean }) {
  await ensureDb();
  const { passwordHash, passwordSalt } = hashPassword(password);
  await sql()`
    update users set
      password_hash = ${passwordHash},
      password_salt = ${passwordSalt},
      must_change_password = ${Boolean(opts?.mustChangePassword)},
      failed_login_count = 0,
      locked_until = null,
      updated_at = now()
    where id = ${userId}
  `;
  if (opts?.revokeRefreshTokens !== false) {
    await sql()`delete from refresh_tokens where user_id = ${userId}`;
  }
}
