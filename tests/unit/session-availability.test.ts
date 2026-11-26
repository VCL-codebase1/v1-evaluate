import { AuthSessionMissingError } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";
import { getSessionProfileByAuthId } from "@/lib/auth/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("next/server", () => ({ connection: jest.fn(async () => undefined) }));
jest.mock("@/lib/auth/users", () => ({
  getSessionProfileByAuthId: jest.fn(),
  ensureUserProfile: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/estimates", () => ({ getLatestEstimateId: jest.fn() }));
jest.mock("@/lib/auth/organizations", () => ({ getOrganizationById: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it("treats a missing session as signed out", async () => {
  jest.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getClaims: jest.fn(async () => ({ data: null, error: new AuthSessionMissingError() })) },
  } as never);
  await expect(getSession()).resolves.toBeNull();
  expect(getSessionProfileByAuthId).not.toHaveBeenCalled();
});

it("does not sign users out when Supabase is temporarily unavailable", async () => {
  const outage = Object.assign(new Error("Auth service unavailable"), { status: 503 });
  jest.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getClaims: jest.fn(async () => ({ data: null, error: outage })) },
  } as never);
  await expect(getSession()).rejects.toThrow("Auth service unavailable");
});

it("does not sign users out when the profile database is temporarily unavailable", async () => {
  jest.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getClaims: jest.fn(async () => ({ data: { claims: { sub: "auth-id" } }, error: null })) },
  } as never);
  jest.mocked(getSessionProfileByAuthId).mockRejectedValue(new Error("Database unavailable"));
  await expect(getSession()).rejects.toThrow("Database unavailable");
});
