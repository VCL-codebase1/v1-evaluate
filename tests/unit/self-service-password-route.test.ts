import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

it.each([
  ["forgot password", forgotPassword],
  ["reset password", resetPassword],
])("disables the %s endpoint", async (_name, handler) => {
  const response = await handler();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: "Contact your organization's Super Admin to reset your password.",
  });
});
