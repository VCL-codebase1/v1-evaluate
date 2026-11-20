import { createHmac, timingSafeEqual } from "crypto";
import type { SessionUser } from "@/lib/types";

type SessionPayload = SessionUser & { iat: number; exp: number };

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET or JWT_SECRET must be set in production.");
  }
  return "v11-estimate-dev-session-secret";
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function encodeSession(session: SessionUser, maxAgeSeconds = 60 * 60 * 12) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...session,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(value: string | undefined | null): SessionUser | null {
  if (!value) return null;

  const parts = value.split(".");
  // Backward-compatible decode for legacy unsigned base64url payloads in non-production.
  if (parts.length === 1) {
    if (process.env.NODE_ENV === "production") return null;
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SessionUser>;
      if (
        !parsed.email ||
        !parsed.role ||
        !parsed.estimateId ||
        !parsed.version ||
        !parsed.organizationId ||
        !parsed.organizationName
      ) {
        return null;
      }
      return {
        email: parsed.email,
        role: parsed.role,
        name: parsed.name || parsed.role,
        estimateId: parsed.estimateId,
        version: parsed.version,
        organizationId: parsed.organizationId,
        organizationName: parsed.organizationName,
      };
    } catch {
      return null;
    }
  }

  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (
      !payload.email ||
      !payload.role ||
      !payload.estimateId ||
      !payload.version ||
      !payload.exp ||
      !payload.organizationId ||
      !payload.organizationName
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      email: payload.email,
      role: payload.role,
      name: payload.name || payload.role,
      estimateId: payload.estimateId,
      version: payload.version,
      organizationId: payload.organizationId,
      organizationName: payload.organizationName,
    };
  } catch {
    return null;
  }
}
