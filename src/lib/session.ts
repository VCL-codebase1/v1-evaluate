import { cache } from "react";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getLatestEstimateId } from "@/lib/estimates";
import {
  ensureUserProfile,
  getSessionProfileByAuthId,
  type SessionProfile,
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
    return (await getLatestEstimateId(organizationId)) ?? "";
  } catch {
    return "";
  }
}

export function sessionUserFromProfile(
  profile: SessionProfile,
  estimateId = "",
): AppSession {
  return {
    userId: profile.id,
    authUserId: profile.authUserId,
    email: profile.email,
    role: profile.role,
    name: profile.name,
    estimateId,
    version: "v1",
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
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

  let profile = await getSessionProfileByAuthId(user.id);
  if (!profile) {
    // Link/create an app profile on first Supabase-authenticated access when possible.
    // For multitenant signups the organization/user profile should already exist;
    // this fallback only applies when org context is explicitly provided in metadata.
    const orgId = typeof user.app_metadata?.organization_id === "string" ? user.app_metadata.organization_id : "";
    if (orgId) {
      const ensured = await ensureUserProfile({
        authUserId: user.id,
        email: user.email ?? "",
        name:
          (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
          (user.email ? user.email.split("@")[0] : "User"),
        role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : undefined,
        organizationId: orgId,
        isActive: true,
      });
      if (ensured) {
        const org = await getOrganizationById(ensured.organizationId).catch(() => null);
        profile = {
          id: ensured.id,
          organizationId: ensured.organizationId,
          authUserId: ensured.authUserId,
          email: ensured.email,
          name: ensured.name,
          role: ensured.role,
          isActive: ensured.isActive,
          mustChangePassword: ensured.mustChangePassword,
          organizationName: org?.name ?? "Organization",
        };
      }
    }
  }

  if (!profile || !profile.isActive) return null;

  const estimateId = await defaultEstimateId(profile.organizationId);
  return sessionUserFromProfile(profile, estimateId);
}

export const getSession = cache(async (): Promise<AppSession | null> => {
  await connection();
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
