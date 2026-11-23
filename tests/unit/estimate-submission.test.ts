import { POST } from "@/app/api/estimates/[id]/submit/route";
import { requireSession } from "@/lib/api";
import { getEstimate, submitSheet } from "@/lib/db";

jest.mock("@/lib/api", () => ({ requireSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ getEstimate: jest.fn(), submitSheet: jest.fn() }));

const session = {
  userId: "rep-a", name: "Alex", email: "alex@example.test", role: "Representative",
  organizationId: "org-a", organizationName: "Test", version: "v1", estimateId: "est",
  authUserId: null, isActive: true, mustChangePassword: false,
};
const request = new Request("https://example.test/api/estimates/est/submit", { method: "POST" });
const context = { params: Promise.resolve({ id: "est" }) };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireSession).mockResolvedValue({ session, response: null });
});

it.each(["rep-b", null])("denies owner %s even when the originator name matches", async ownerUserId => {
  (getEstimate as jest.Mock).mockResolvedValue({ ownerUserId, originator: session.name });
  expect((await POST(request, context)).status).toBe(403);
  expect(submitSheet).not.toHaveBeenCalled();
});

it("accepts the original owner after a rename and records their email", async () => {
  (getEstimate as jest.Mock).mockResolvedValue({ ownerUserId: session.userId, originator: "Former name" });
  (submitSheet as jest.Mock).mockResolvedValue({ sheet: {} });
  expect((await POST(request, context)).status).toBe(200);
  expect(submitSheet).toHaveBeenCalledWith("est", session.organizationId, session.email, "v1");
});
