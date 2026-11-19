import type { SessionUser } from "@/lib/types";

export function encodeSession(session: SessionUser) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function decodeSession(value: string | undefined | null): SessionUser | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<SessionUser>;

    if (!parsed.email || !parsed.role || !parsed.estimateId || !parsed.version) {
      return null;
    }

    return {
      email: parsed.email,
      role: parsed.role,
      name: parsed.name || parsed.role,
      estimateId: parsed.estimateId,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}
