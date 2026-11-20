import { createHash, randomBytes } from "crypto";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import { findUserByEmail, setPassword } from "@/lib/auth/users";
import { log } from "@/lib/observability/logger";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(email: string, meta?: { ip?: string; userAgent?: string }) {
  await ensureDb();
  const user = await findUserByEmail(email);
  // Generic behavior to avoid account enumeration.
  if (!user || !user.isActive) {
    log.info("auth.password_reset.requested", { emailFound: false });
    return { ok: true as const };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const id = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await sql()`update password_reset_tokens set used_at = now() where user_id = ${user.id} and used_at is null`;
  await sql()`
    insert into password_reset_tokens(id, user_id, token_hash, expires_at, requested_ip, requested_user_agent)
    values (${id}, ${user.id}, ${tokenHash}, ${expiresAt}, ${meta?.ip ?? null}, ${meta?.userAgent ?? null})
  `;

  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const resetUrl = baseUrl ? `${baseUrl}/reset-password?token=${rawToken}` : `/reset-password?token=${rawToken}`;

  // No SMTP transport is bundled in this repo. In production, integrate a mail provider
  // and send resetUrl out-of-band; do not log the token URL in production.
  if (process.env.NODE_ENV === "production") {
    log.info("auth.password_reset.token_issued", { userId: user.id, delivery: "not_configured" });
  } else {
    log.warn("auth.password_reset.token_issued", {
      userId: user.id,
      expiresAt,
      resetUrl,
      delivery: "logged_for_development_only",
    });
  }

  return { ok: true as const };
}

export async function consumePasswordResetToken(token: string, newPassword: string) {
  await ensureDb();
  if (!token || newPassword.length < 8) return { ok: false as const, error: "Reset link is invalid or has expired." };
  const tokenHash = hashToken(token);
  const rows = await sql()`
    select id, user_id, expires_at, used_at
    from password_reset_tokens
    where token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0] as { id?: string; user_id?: string; expires_at?: unknown; used_at?: unknown } | undefined;
  if (!row?.id || !row.user_id) return { ok: false as const, error: "Reset link is invalid or has expired." };
  if (row.used_at) return { ok: false as const, error: "Reset link has already been used." };
  const expiresAt = row.expires_at ? new Date(row.expires_at as string).getTime() : 0;
  if (!expiresAt || expiresAt < Date.now()) return { ok: false as const, error: "Reset link is invalid or has expired." };

  await sql()`
    update password_reset_tokens set used_at = now() where id = ${String(row.id)} and used_at is null
  `;
  await setPassword(String(row.user_id), newPassword, { mustChangePassword: false, revokeRefreshTokens: true });
  log.info("auth.password_reset.completed", { userId: String(row.user_id) });
  return { ok: true as const };
}
