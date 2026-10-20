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

test("mobile: open a building and add a resident", async ({ page }) => {
  await signIn(page);
  await page.goto("/buildings");
  await page.getByRole("link", { name: /הירקון 112/ }).click();
  await page.getByRole("link", { name: "דיירים" }).click();
  await expect(page).toHaveURL(/tab=residents/);
  await page.getByText("הוספת דייר").click();
  const name = `דייר בדיקה ${Date.now()}`;
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="phone"]').fill("052-0000555");
  await page.locator('input[name="unit"]').fill("99");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByRole("link", { name: "וואטסאפ" }).first()).toHaveAttribute("href", /wa\.me\/972/);
});

test("mobile: mark a maintenance item done and get asked for a frequency", async ({ page }) => {
  await signIn(page);
  await page.goto("/maintenance");
  await expect(page.getByRole("heading", { name: "יומן תחזוקה" })).toBeVisible();
  await page.getByRole("link", { name: /ויצמן 9/ }).first().click();
  await page.getByRole("button", { name: /בדיקת גג/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "סימון כבוצע" }).click();
  await expect(page.getByRole("status")).toContainText("הגדירו תדירות");
});

test("mobile: add a supplier and see it grouped by category", async ({ page }) => {
  await signIn(page);
  await page.goto("/suppliers");
  await page.getByRole("button", { name: "הוספה" }).click();
  const name = `ספק בדיקה ${Date.now()}`;
  await page.getByRole("dialog").locator('input[name="name"]').fill(name);
  await page.getByRole("dialog").locator('select[name="category"]').selectOption("הדברה");
  await page.getByRole("dialog").getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { name: "הדברה" })).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
});

test.describe("desktop 1280", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("rail visible, bottom nav hidden, Today in two columns", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("complementary").getByRole("link", { name: "יומן תחזוקה" })).toBeVisible();
    await expect(page.locator("nav.fixed")).toBeHidden();
    const cols = await page.getByTestId("today-columns").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(2);
  });

  test("ticket list shows assignee and due columns", async ({ page }) => {
    await signIn(page);
    await page.goto("/tickets");
    await expect(page.getByRole("main").getByText("עומר שטיגליץ", { exact: true }).last()).toBeVisible();
  });
});

test("mobile: assignee column is hidden on the ticket list", async ({ page }) => {
  await signIn(page);
  await page.goto("/tickets");
  await expect(page.getByRole("main").getByText("עומר שטיגליץ", { exact: true }).last()).toBeHidden();
});
