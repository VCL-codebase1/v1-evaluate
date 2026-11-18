import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { decodeSession } from "@/lib/session-token";
import type { SessionUser } from "@/lib/types";

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}
