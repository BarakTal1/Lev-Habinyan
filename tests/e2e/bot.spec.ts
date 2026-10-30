import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("email").fill("dev@lev.local");
  await page.getByPlaceholder("password").fill("dev-password-local");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await expect(page).toHaveURL("/");
}

/** Writes to the bot as a resident, in the simulator. */
function simulator(page: Page) {
  const chat = page.getByRole("list", { name: "chat" });
  return {
    say: async (text: string) => {
      await page.getByLabel("כתבו הודעה").fill(text);
      await page.getByRole("button", { name: "שליחה", exact: true }).click();
    },
    tap: (name: string) => chat.getByRole("button", { name }).last().click(),
    chat,
  };
}

test("bot: a new resident reports a fault, a founder approves, messages the resident, who confirms", async ({ page }) => {
  await signIn(page);

  // A building with its own street, so the bot finds it whatever else is in the database.
  const stamp = Date.now();
  const building = `בוט ${stamp}`, street = `רחוב הבדיקה ${stamp}`, resident = `דייר ${stamp}`;
  await page.goto("/buildings");
  await page.getByText("הוספת בניין").click();
  await page.locator('input[name="name"]').fill(building);
  await page.locator('input[name="address"]').fill(street);
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(building);

  // The resident writes from a number the system does not know.
  await page.goto("/dev/simulator");
  await expect(page).toHaveURL(/phone=05299\d+/);
  const phone = await page.getByLabel("טלפון").inputValue();
  const sim = simulator(page);
  await sim.say("שלום");
  await expect(sim.chat.getByText("שומרים את מספר הטלפון")).toBeVisible();
  await sim.tap("אני מסכים/ה");

  const streetQ = page.getByText("מה שם הרחוב והמספר של הבניין?");
  const listQ = page.getByText("באיזה בניין את/ה גר/ה?");
  await expect(streetQ.or(listQ).last()).toBeVisible();
  if (await streetQ.last().isVisible()) await sim.say(street); else await sim.tap(building);
  await expect(page.getByText("מה מספר הדירה?")).toBeVisible();
  await sim.say("7");
  await expect(page.getByText("איך קוראים לך?")).toBeVisible();
  await sim.say(resident);
  await sim.tap("שוכר/ת");

  await sim.tap("דיווח על תקלה");
  await sim.tap("בדירה שלי");
  await sim.tap("נזילה / אינסטלציה");
  await sim.tap("לא");
  await sim.say("דליפה בתקרה");
  await sim.tap("אישור");
  await expect(sim.chat.getByText(/מספר פנייה \d+/)).toBeVisible();

  // The founder sees the resident waiting, and the ticket marked as not approved.
  await page.goto("/");
  const card = page.getByRole("listitem").filter({ hasText: resident });
  await expect(card).toBeVisible();
  await page.goto("/buildings");
  await page.getByRole("link", { name: new RegExp(building) }).click();
  await expect(page.getByText("נזילה / אינסטלציה · בדירה")).toBeVisible();
  await page.getByText("נזילה / אינסטלציה · בדירה").click();
  await expect(page.getByText("לא מאושר").first()).toBeVisible();
  const ticketUrl = page.url();

  // One tap approves the resident, and the flag disappears.
  await page.goto("/");
  await page.getByRole("listitem").filter({ hasText: resident }).getByRole("button", { name: "אישור" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: resident })).toHaveCount(0);
  await page.goto(ticketUrl);
  await expect(page.getByText("לא מאושר")).toHaveCount(0);

  // Done: the founder sees the message before it goes out, and sends it with the status change.
  await page.getByLabel("סטטוס").selectOption("בוצע");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveValue(/טופלה/);
  await dialog.getByRole("button", { name: "שלח הודעה ושנה סטטוס" }).click();
  await expect(dialog).toHaveCount(0);

  // The resident gets it with two buttons, and answers yes.
  await page.goto(`/dev/simulator?phone=${phone}`);
  await expect(sim.chat.getByText(/טופלה/)).toBeVisible();
  await sim.tap("כן");
  await expect(sim.chat.getByText("תודה על העדכון")).toBeVisible();

  // The history of the ticket shows the message with its delivery, and the answer.
  await page.goto(ticketUrl);
  await expect(page.getByText(/הודעה: .*טופלה.* · נשלחה/)).toBeVisible();
  await expect(page.getByText("הודעה: הדייר אישר")).toBeVisible();
});

test("settings: a founder saves the working hours and the emergency number", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  const form = page.getByRole("region", { name: "בוט וואטסאפ" }).or(page.locator("section").filter({ hasText: "טלפונים להתראת סכנה" }));
  await form.getByLabel("א׳").check();
  await form.getByLabel("ב׳").check();
  await form.getByLabel("משעה").fill("09:00");
  await form.getByLabel("עד שעה").fill("17:00");
  await form.getByLabel("מספר חירום לדיירים").fill("100");
  await form.getByRole("button", { name: "שמירה" }).click();
  await expect(form.getByRole("status")).toHaveText("נשמר");
  await page.reload();
  await expect(form.getByLabel("משעה")).toHaveValue("09:00");
  await expect(form.getByLabel("מספר חירום לדיירים")).toHaveValue("100");

  // Hours that close before they open are refused, with a message.
  await form.getByLabel("משעה").fill("18:00");
  await form.getByLabel("עד שעה").fill("08:00");
  await form.getByRole("button", { name: "שמירה" }).click();
  await expect(form.getByRole("alert")).toContainText("שעת הסיום");

  // Put the settings back: no days means always open, an empty number clears it.
  await page.reload();
  for (const d of ["א׳", "ב׳"]) await form.getByLabel(d).uncheck();
  await form.getByLabel("מספר חירום לדיירים").fill("");
  await form.getByRole("button", { name: "שמירה" }).click();
  await expect(form.getByRole("status")).toHaveText("נשמר");
});
