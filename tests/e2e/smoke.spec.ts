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

test("mobile: import the control sheet with a preview and flagged problems", async ({ page }) => {
  await signIn(page);
  await page.goto("/import");
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/control-sheet.csv");
  await expect(page.getByText("בניין ייבוא fixture")).toBeVisible();
  await expect(page.getByText("בערך פעם בחורף").or(page.getByText(/גג/)).first()).toBeVisible();
  await page.getByRole("button", { name: "אישור וייבוא" }).click();
  await expect(page.getByRole("status")).toContainText("הייבוא הסתיים");
});

test("mobile: a 3 MB phone photo uploads to a ticket", async ({ page }) => {
  await signIn(page);
  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "ויצמן 9" }).click();
  await page.getByRole("textbox").first().fill(`תמונה גדולה ${Date.now()}`);
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("תמונה גדולה");
  await page.locator('input[type="file"][name="file"]').first().setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(3 * 1024 * 1024, 1) });
  await page.getByRole("button", { name: "הוספת תמונה" }).click();
  await expect(page.getByRole("main").locator("a > img")).toHaveCount(1, { timeout: 15000 });
});

test("mobile: edit a ticket and set a visit time", async ({ page }) => {
  await signIn(page);
  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "ויצמן 9" }).click();
  await page.getByRole("textbox").first().fill(`לעריכה ${Date.now()}`);
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("לעריכה");
  await page.getByRole("button", { name: "עריכה" }).click();
  const dialog = page.getByRole("dialog");
  const newTitle = `נערך ${Date.now()}`;
  await dialog.locator('input[name="title"]').fill(newTitle);
  await dialog.locator('input[name="scheduled_at"]').fill("2026-12-02T09:30");
  await dialog.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(newTitle);
  await expect(page.getByText("2026-12-02 09:30")).toBeVisible();
});

test("mobile: archive a ticket and it leaves the list", async ({ page }) => {
  await signIn(page);
  await page.goto("/tickets/new");
  await page.getByRole("button", { name: "ויצמן 9" }).click();
  const title = `לארכוב ${Date.now()}`;
  await page.getByRole("textbox").first().fill(title);
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "העברה לארכיון" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByRole("main").getByText(title)).toHaveCount(0);
});

test("mobile: edit a building, then archive it", async ({ page }) => {
  await signIn(page);
  await page.goto("/buildings");
  await page.getByText("הוספת בניין").click();
  const name = `בניין לעריכה ${Date.now()}`;
  await page.locator('input[name="name"]').fill(name);
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page.getByRole("button", { name: "עריכת בניין" }).click();
  const dialog = page.getByRole("dialog");
  const renamed = `${name} ב`;
  await dialog.locator('input[name="name"]').fill(renamed);
  await dialog.locator('input[name="city"]').fill("חיפה");
  await dialog.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed);
  await expect(page.getByText("חיפה")).toBeVisible();
  await page.getByRole("button", { name: "עריכת בניין" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("dialog").getByRole("button", { name: "העברת הבניין לארכיון" }).click();
  await expect(page).toHaveURL(/\/buildings$/);
  await expect(page.getByRole("main").getByText(renamed)).toHaveCount(0);
});
