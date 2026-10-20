import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("email").fill("dev@lev.local");
  await page.getByPlaceholder("password").fill("dev-password-local");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("mobile: create a ticket in a few taps and see it in the list", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: /בוקר טוב/ })).toBeVisible();
  await page.getByRole("link", { name: "כרטיס חדש" }).click();
  await page.getByRole("button", { name: "ויצמן 9" }).click();
  const title = `בדיקת עשן ${Date.now()}`;
  await page.getByRole("textbox").first().fill(title);
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("link", { name: "כרטיסים" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByRole("main").getByText(title)).toBeVisible();
});

test("a signed-out visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/tickets");
  await expect(page).toHaveURL(/sign-in/);
});
