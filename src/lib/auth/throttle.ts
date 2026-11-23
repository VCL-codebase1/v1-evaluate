import { createHash } from "crypto";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";

export type ThrottleConfig = {
  scope: string;
  subject: string;
  windowMs: number;
  maxFailures: number;
  blockMs: number;
};

export function throttleSubject(scope: string, raw: string) {
  return createHash("sha256").update(`${scope}:${raw}`.toLowerCase()).digest("hex");
}

export async function checkThrottle(config: ThrottleConfig) {
  await ensureDb();
  const now = new Date();
  const rows = await sql()`
    select fail_count, blocked_until, window_started_at
    from auth_throttle
    where scope = ${config.scope} and subject = ${config.subject}
    limit 1
  `;
  const row = rows[0] as { blocked_until?: Date | string | null } | undefined;
  if (!row) return { blocked: false as const, retryAfterSec: 0 };

  const blockedUntil = row.blocked_until ? new Date(row.blocked_until as string) : null;
  if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
    const retryAfterSec = Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
    return { blocked: true as const, retryAfterSec };
  }
  return { blocked: false as const, retryAfterSec: 0 };
}

export async function checkSignupThrottles(ip: ThrottleConfig, email: ThrottleConfig) {
  await ensureDb();
  const rows = await sql()`
    select scope, subject, blocked_until
    from auth_throttle
    where (scope = ${ip.scope} and subject = ${ip.subject})
       or (scope = ${email.scope} and subject = ${email.subject})
  `;
  const now = Date.now();
  for (const config of [ip, email]) {
    const row = rows.find((entry) => entry.scope === config.scope && entry.subject === config.subject);
    const blockedUntil = row?.blocked_until ? new Date(row.blocked_until as string).getTime() : 0;
    if (blockedUntil > now) {
      return { blocked: true as const, retryAfterSec: Math.max(1, Math.ceil((blockedUntil - now) / 1000)) };
    }
  }
  return { blocked: false as const, retryAfterSec: 0 };
}

export async function registerFailure(config: ThrottleConfig) {
  await ensureDb();
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - config.windowMs);
  const blockedUntil = new Date(now.getTime() + config.blockMs);

  await sql()`
    insert into auth_throttle(scope, subject, window_started_at, fail_count, blocked_until, updated_at)
    values (${config.scope}, ${config.subject}, ${now.toISOString()}, 1, null, ${now.toISOString()})
    on conflict (scope, subject) do update set
      window_started_at = case
        when auth_throttle.window_started_at < ${windowStartCutoff.toISOString()} then ${now.toISOString()}
        else auth_throttle.window_started_at
      end,
      fail_count = case
        when auth_throttle.window_started_at < ${windowStartCutoff.toISOString()} then 1
        else auth_throttle.fail_count + 1
      end,
      blocked_until = case
        when (case
          when auth_throttle.window_started_at < ${windowStartCutoff.toISOString()} then 1
          else auth_throttle.fail_count + 1
        end) >= ${config.maxFailures} then ${blockedUntil.toISOString()}
        else null
      end,
      updated_at = ${now.toISOString()}
  `;

  const rows = await sql()`
    select fail_count, blocked_until from auth_throttle
    where scope = ${config.scope} and subject = ${config.subject}
    limit 1
  `;
  const row = rows[0] as { fail_count?: number; blocked_until?: Date | string | null } | undefined;
  const bu = row?.blocked_until ? new Date(row.blocked_until as string) : null;
  const blocked = Boolean(bu && bu.getTime() > now.getTime());
  return {
    blocked,
    retryAfterSec: blocked && bu ? Math.max(1, Math.ceil((bu.getTime() - now.getTime()) / 1000)) : 0,
    failCount: Number(row?.fail_count ?? 0),
  };
}

export async function clearThrottle(scope: string, subject: string) {
  await ensureDb();
  await sql()`delete from auth_throttle where scope = ${scope} and subject = ${subject}`;
}
