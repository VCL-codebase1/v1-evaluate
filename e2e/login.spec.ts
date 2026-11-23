import { expect, test } from "@playwright/test";

test("login page is the unsigned entry", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an organization" })).toBeVisible();
});
