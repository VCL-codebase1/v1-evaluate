import { expect, test } from "@playwright/test";

test("login page is the unsigned entry", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an organization" })).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.svg/);
});

test("unsigned visitors cannot open the workspace or password setup", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto("/change-password");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test.describe("staging account journey", () => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for the staging sign-in flow.");

  test("a configured admin can sign in and reach user administration", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User administration" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create user" })).toBeVisible();
    await page.goto("/estimation");
    await expect(page.getByRole("heading", { name: "Estimation sheet" })).toBeVisible();
  });
});
