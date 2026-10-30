import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/labels";
import { DANGER_WORDS, FAULT_TYPES, PLACES, hasDangerWord } from "@/lib/bot/catalog";
import { bot, privacyVersion } from "@/lib/bot/texts";

describe("fault catalog", () => {
  it("uses only known categories", () => {
    for (const f of FAULT_TYPES) expect(CATEGORIES).toContain(f.category);
  });
  it("has the expected ids", () => {
    expect(FAULT_TYPES.map((f) => f.id)).toEqual(["lift", "plumbing", "electric", "gate", "cleaning", "garden", "water", "other"]);
  });
  it("keeps list titles at most 24 characters", () => {
    for (const f of FAULT_TYPES) expect(f.title.length).toBeLessThanOrEqual(24);
    for (const p of PLACES) expect(p.title.length).toBeLessThanOrEqual(24);
  });
  it("keeps the places list within the WhatsApp limit of 10 rows", () => {
    expect(PLACES.length).toBeLessThanOrEqual(10);
    expect(FAULT_TYPES.length).toBeLessThanOrEqual(10);
  });
  it("lists danger words", () => expect(DANGER_WORDS.length).toBeGreaterThan(0));
});

describe("hasDangerWord", () => {
  it.each(["יש הצפה בחדר מדרגות", "ריח גז", "יש אש", "אני תקוע במעלית", "תקועה במעלית", "אנחנו תקועים במעלית", "בגז", "הצפות", "שריפה"])("is true for %s", (text) => {
    expect(hasDangerWord(text)).toBe(true);
  });
  it.each(["נורה שרופה בלובי", "", "אשכנזי", "קצר", "תיאור קצר"])("is false for %j", (text) => {
    expect(hasDangerWord(text)).toBe(false);
  });
});

describe("bot texts", () => {
  it("keeps every button title at most 20 characters", () => {
    for (const title of Object.values(bot.btn)) expect(title.length).toBeLessThanOrEqual(20);
    for (const label of [bot.placeButton, bot.typeButton, bot.unkBuildingButton]) expect(label.length).toBeLessThanOrEqual(20);
  });
  it("builds the ticket number message", () => {
    expect(bot.ticketCreated(1042)).toBe("קיבלנו. מספר פנייה 1042. נעדכן אותך כאן בכל שינוי.");
  });
  it("tells the resident to call the emergency number only when one is set", () => {
    expect(bot.dangerReply("050-1234567", true)).toContain("050-1234567");
    expect(bot.dangerReply(null, true)).not.toMatch(/\d/);
  });
  it("sets the privacy version", () => expect(privacyVersion).toBe("v1"));
});
