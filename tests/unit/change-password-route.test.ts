import { POST } from "@/app/api/auth/change-password/route";
import { clearPasswordState } from "@/lib/auth/users";
import { getSession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/auth/users", () => ({ clearPasswordState: jest.fn() }));
jest.mock("@/lib/session", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn() }));

const updateUser = jest.fn();

function request(password = "new-private-password") {
  return new Request("https://example.test/api/auth/change-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSession).mockResolvedValue({
    userId: "user-id", authUserId: "auth-id", mustChangePassword: false,
    isActive: true, email: "admin@example.test", name: "Admin", role: "Super Admin",
    organizationId: "org-id", organizationName: "Test Org", estimateId: "", version: "v1",
  });
  jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { updateUser } } as never);
  updateUser.mockResolvedValue({ data: { user: { id: "auth-id" } }, error: null });
  jest.mocked(clearPasswordState).mockResolvedValue(undefined);
});

it("lets the Super Admin change their own password", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(updateUser).toHaveBeenCalledWith({ password: "new-private-password" });
  expect(clearPasswordState).toHaveBeenCalledWith("user-id", { mustChangePassword: false, revokeRefreshTokens: true });
});

it("does not update local state when the provider rejects the password", async () => {
  updateUser.mockResolvedValue({ data: { user: null }, error: { message: "Rejected" } });
  expect((await POST(request())).status).toBe(502);
  expect(clearPasswordState).not.toHaveBeenCalled();
});

it("explains when the new password matches the current password", async () => {
  updateUser.mockResolvedValue({
    data: { user: null },
    error: { message: "New password should be different from the old password." },
  });
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "Choose a password different from the one you used to sign in.",
  });
  expect(clearPasswordState).not.toHaveBeenCalled();
});

it("rejects a regular user's self-service password change", async () => {
  jest.mocked(getSession).mockResolvedValue({
    userId: "user-id", authUserId: "auth-id", mustChangePassword: true,
    isActive: true, email: "rep@example.test", name: "Rep", role: "Representative",
    organizationId: "org-id", organizationName: "Test Org", estimateId: "", version: "v1",
  });
  expect((await POST(request())).status).toBe(403);
  expect(updateUser).not.toHaveBeenCalled();
});

it("requires sign-in", async () => {
  jest.mocked(getSession).mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(updateUser).not.toHaveBeenCalled();
});
