import { authCookieOptions } from "@/lib/auth/session-cookie";

it("keeps a remembered auth cookie persistent", () => {
  expect(authCookieOptions({ path: "/", maxAge: 3600 }, false)).toEqual({ path: "/", maxAge: 3600 });
});

it("uses a browser-session cookie when remember me is off", () => {
  expect(authCookieOptions({ path: "/", maxAge: 3600, expires: new Date("2030-01-01") }, true))
    .toEqual({ path: "/" });
});

it("preserves cookie deletion when the session expires", () => {
  expect(authCookieOptions({ path: "/", maxAge: 0 }, true)).toEqual({ path: "/", maxAge: 0 });
});
