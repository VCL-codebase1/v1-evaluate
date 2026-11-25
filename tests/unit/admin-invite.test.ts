import { POST } from "@/app/api/admin/users/route";
import { getSession } from "@/lib/session";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/session", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/auth/users", () => ({ createUser: jest.fn(), findUserByEmail: jest.fn(), listUsers: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: jest.fn() }));

const inviteUserByEmail = jest.fn();
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
    inviteUserByEmail, updateUserById, createUser: createAuthUser, deleteUser,
  } } } as never);
  inviteUserByEmail.mockResolvedValue({ data: { user: { id: "invited-auth-id" } }, error: null });
  updateUserById.mockResolvedValue({ error: null });
  jest.mocked(createUser).mockResolvedValue({ id: "app-user-id", email: "new@example.test" } as never);
});

it("invites a colleague and stores their organization role", async () => {
  const request = new Request("https://example.test/api/admin/users", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "new@example.test", name: "New User", role: "Representative", invite: true }),
  });
  const response = await POST(request);
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ invitationSent: true });
  expect(inviteUserByEmail).toHaveBeenCalledWith("new@example.test", expect.objectContaining({
    redirectTo: "https://example.test/reset-password?invite=1",
  }));
  expect(updateUserById).toHaveBeenCalledWith("invited-auth-id", { app_metadata: { role: "Representative", organization_id: "org-id" } });
  expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ authUserId: "invited-auth-id", organizationId: "org-id", mustChangePassword: true }));
  expect(createAuthUser).not.toHaveBeenCalled();
});
