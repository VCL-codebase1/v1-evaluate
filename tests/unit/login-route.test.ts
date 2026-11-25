import { POST } from "@/app/api/auth/login/route";
import { cookies } from "next/headers";
import { checkThrottles, completeLogin, registerFailure } from "@/lib/auth/throttle";
import { getSessionProfileByAuthId } from "@/lib/auth/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/auth/throttle", () => ({
  checkThrottles: jest.fn(), completeLogin: jest.fn(), registerFailure: jest.fn(),
  throttleSubject: jest.fn((_scope: string, value: string) => value),
}));
jest.mock("@/lib/auth/users", () => ({ getSessionProfileByAuthId: jest.fn(), isUserLocked: jest.fn(() => false) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const signInWithPassword = jest.fn();

function request(remember = true) {
  return new Request("https://example.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "rep@example.test", password: "test-password", remember }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(checkThrottles).mockResolvedValue({ blocked: false, retryAfterSec: 0 });
  jest.mocked(completeLogin).mockResolvedValue(undefined);
  jest.mocked(registerFailure).mockResolvedValue({ blocked: false, retryAfterSec: 0, failCount: 1 });
  jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { signInWithPassword } } as never);
  jest.mocked(cookies).mockResolvedValue({ set: jest.fn(), delete: jest.fn() } as never);
});

it("signs in with the workspace profile and completes bookkeeping", async () => {
  signInWithPassword.mockResolvedValue({ data: { user: { id: "auth-id" } }, error: null });
  jest.mocked(getSessionProfileByAuthId).mockResolvedValue({
    id: "user-id", authUserId: "auth-id", email: "rep@example.test", name: "Rep",
    role: "Representative", organizationId: "org-id", organizationName: "Test Org",
    estimateId: "est-id", isActive: true, mustChangePassword: false,
    failedLoginCount: 0, lockedUntil: null,
  });

  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ user: { organizationId: "org-id", organizationName: "Test Org" } });
  expect(completeLogin).toHaveBeenCalledWith("user-id", "unknown", "rep@example.test");
  expect(createSupabaseServerClient).toHaveBeenCalledWith({ sessionOnly: false });
});

it("uses session cookies when remember me is off", async () => {
  signInWithPassword.mockResolvedValue({ data: { user: { id: "auth-id" } }, error: null });
  jest.mocked(getSessionProfileByAuthId).mockResolvedValue({
    id: "user-id", authUserId: "auth-id", email: "rep@example.test", name: "Rep",
    role: "Representative", organizationId: "org-id", organizationName: "Test Org",
    estimateId: "", isActive: true, mustChangePassword: false,
    failedLoginCount: 0, lockedUntil: null,
  });
  const response = await POST(request(false));
  expect(response.status).toBe(200);
  expect(createSupabaseServerClient).toHaveBeenCalledWith({ sessionOnly: true });
  const store = await cookies();
  expect(store.set).toHaveBeenCalledWith("v11_session_only", "1", expect.objectContaining({ httpOnly: true }));
});

it("signs in an existing user even if the old password-change flag remains set", async () => {
  signInWithPassword.mockResolvedValue({ data: { user: { id: "auth-id" } }, error: null });
  jest.mocked(getSessionProfileByAuthId).mockResolvedValue({
    id: "user-id", authUserId: "auth-id", email: "rep@example.test", name: "Rep",
    role: "Representative", organizationId: "org-id", organizationName: "Test Org",
    estimateId: "", isActive: true, mustChangePassword: true,
    failedLoginCount: 0, lockedUntil: null,
  });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).not.toHaveProperty("mustChangePassword");
});

it("reports an Auth outage without recording a wrong-password attempt", async () => {
  signInWithPassword.mockResolvedValue({ data: { user: null }, error: { status: 503, message: "Service unavailable" } });

  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(registerFailure).not.toHaveBeenCalled();
});
