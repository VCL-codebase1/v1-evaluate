import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { listEstimates } from "@/lib/db";
import {
  ensureUserProfile,
  getUserProfileByAuthId,
  type DbUser,
} from "@/lib/auth/users";
import { getOrganizationById } from "@/lib/auth/organizations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

export type AppSession = SessionUser & {
  userId: string;
  authUserId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
};

async function defaultEstimateId(organizationId: string) {
  try {
    const estimates = await listEstimates(organizationId);
    return estimates[0]?.id ?? "EST-2026-001";
  } catch {
    return "EST-2026-001";
  }
}

export function sessionUserFromProfile(
  profile: DbUser,
  estimateId?: string,
  organizationName = "Organization",
): AppSession {
  return {
    userId: profile.id,
    authUserId: profile.authUserId,
    email: profile.email,
    role: profile.role,
    name: profile.name,
    estimateId: estimateId ?? "EST-2026-001",
    version: "v1",
    organizationId: profile.organizationId,
    organizationName,
    isActive: profile.isActive,
    mustChangePassword: profile.mustChangePassword,
  };
}

async function resolveSession(): Promise<AppSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let profile = await getUserProfileByAuthId(user.id);
  if (!profile) {
    // Link/create an app profile on first Supabase-authenticated access when possible.
    // For multitenant signups the organization/user profile should already exist;
    // this fallback only applies when org context is explicitly provided in metadata.
    const orgId = typeof user.app_metadata?.organization_id === "string" ? user.app_metadata.organization_id : "";
    if (orgId) {
      profile = await ensureUserProfile({
        authUserId: user.id,
        email: user.email ?? "",
        name:
          (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
          (user.email ? user.email.split("@")[0] : "User"),
        role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : undefined,
        organizationId: orgId,
        isActive: true,
      });
    }
  }

  if (!profile) return null;
  if (!profile.isActive) return null;

  const org = await getOrganizationById(profile.organizationId).catch(() => null);
  const estimateId = await defaultEstimateId(profile.organizationId);
  return sessionUserFromProfile(profile, estimateId, org?.name ?? "Organization");
}

export const getSession = cache(async (): Promise<AppSession | null> => {
  try {
    return await resolveSession();
  } catch {
    return null;
  }
});

export async function getSupabaseAuthUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
