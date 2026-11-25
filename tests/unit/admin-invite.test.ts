import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";
import { getSession } from "@/lib/session";
import { createUser, findUserByEmail, findUserById, updateUserAdmin } from "@/lib/auth/users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/session", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/auth/users", () => ({ createUser: jest.fn(), findUserByEmail: jest.fn(), findUserById: jest.fn(), listUsers: jest.fn(), updateUserAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: jest.fn() }));

const updateUserById = jest.fn();
const createAuthUser = jest.fn();
const deleteUser = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSession).mockResolvedValue({
    userId: "admin-id", authUserId: "auth-admin", email: "admin@example.test", name: "Admin",
    role: "Super Admin", organizationId: "org-id", organizationName: "Test Org",
    estimateId: "", version: "v1", isActive: true, mustChangePassword: false,
  });
  jest.mocked(findUserByEmail).mockResolvedValue(null);
  jest.mocked(createSupabaseAdminClient).mockReturnValue({ auth: { admin: {
    updateUserById, createUser: createAuthUser, deleteUser,
  } } } as never);
  updateUserById.mockResolvedValue({ error: null });
  jest.mocked(createUser).mockResolvedValue({ id: "app-user-id", email: "new@example.test" } as never);
  jest.mocked(updateUserAdmin).mockResolvedValue({ id: "user-id", role: "Representative", isActive: true } as never);
});

it("rejects invitations so users receive only Super Admin-created credentials", async () => {
  const request = new Request("https://example.test/api/admin/users", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "new@example.test", name: "New User", role: "Representative", invite: true }),
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
  expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  expect(createAuthUser).not.toHaveBeenCalled();
});

it("rejects ordinary Admin access to user listing, creation, and reset", async () => {
  jest.mocked(getSession).mockResolvedValue({
    userId: "admin-id", authUserId: "auth-admin", email: "admin@example.test", name: "Admin",
    role: "Admin", organizationId: "org-id", organizationName: "Test Org",
    estimateId: "", version: "v1", isActive: true, mustChangePassword: false,
  });
  expect((await GET()).status).toBe(403);
  expect((await POST(new Request("https://example.test/api/admin/users", {
    method: "POST", body: JSON.stringify({ email: "new@example.test", name: "New User", role: "Representative", invite: true }),
  }))).status).toBe(403);
  expect((await PATCH(new Request("https://example.test/api/admin/users/user-id", {
    method: "PATCH", body: JSON.stringify({ resetPassword: "new-password" }),
  }), { params: Promise.resolve({ id: "user-id" }) })).status).toBe(403);
  expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

it("creates a user who can sign in with the assigned password", async () => {
  createAuthUser.mockResolvedValue({ data: { user: { id: "created-auth-id" } }, error: null });
  const response = await POST(new Request("https://example.test/api/admin/users", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "new@example.test", name: "New User", role: "Representative", password: "assigned-password" }),
  }));
  expect(response.status).toBe(201);
  expect(createAuthUser).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.test", password: "assigned-password", email_confirm: true }));
  expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: false, organizationId: "org-id" }));
});

it("lets the Super Admin reset an organization user's password without forcing another change", async () => {
  jest.mocked(findUserById).mockResolvedValue({
    id: "user-id", authUserId: "auth-user-id", organizationId: "org-id", role: "Representative",
  } as never);
  const response = await PATCH(new Request("https://example.test/api/admin/users/user-id", {
    method: "PATCH", body: JSON.stringify({ resetPassword: "new-assigned-password" }),
  }), { params: Promise.resolve({ id: "user-id" }) });
  expect(response.status).toBe(200);
  expect(updateUserById).toHaveBeenCalledWith("auth-user-id", expect.objectContaining({ password: "new-assigned-password" }));
  expect(updateUserAdmin).toHaveBeenCalledWith("user-id", { mustChangePassword: false }, "org-id");
});

it("does not reset an account from another organization", async () => {
  jest.mocked(findUserById).mockResolvedValue({ id: "other-user", organizationId: "other-org" } as never);
  const response = await PATCH(new Request("https://example.test/api/admin/users/other-user", {
    method: "PATCH", body: JSON.stringify({ resetPassword: "new-password" }),
  }), { params: Promise.resolve({ id: "other-user" }) });
  expect(response.status).toBe(404);
  expect(updateUserAdmin).not.toHaveBeenCalled();
  expect(updateUserById).not.toHaveBeenCalled();
});

it("does not claim a password reset succeeded for an unlinked account", async () => {
  jest.mocked(findUserById).mockResolvedValue({
    id: "user-id", authUserId: null, organizationId: "org-id", role: "Representative",
  } as never);
  const response = await PATCH(new Request("https://example.test/api/admin/users/user-id", {
    method: "PATCH", body: JSON.stringify({ resetPassword: "new-assigned-password" }),
  }), { params: Promise.resolve({ id: "user-id" }) });
  expect(response.status).toBe(409);
  expect(updateUserAdmin).not.toHaveBeenCalled();
});
