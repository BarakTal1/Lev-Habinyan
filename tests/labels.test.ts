import { describe, expect, it } from "vitest";
import { SYSTEMS, STATUSES, URGENCIES, RESPONSIBILITIES } from "@/lib/labels";
import { badge } from "@/lib/tokens";

describe("labels", () => {
  it("has the 12 maintenance systems including fire inspection", () => {
    expect(SYSTEMS).toHaveLength(12);
    expect(SYSTEMS).toContain("בדיקת כיבוי אש");
  });
  it("has 7 statuses starting with חדש", () => {
    expect(STATUSES).toHaveLength(7);
    expect(STATUSES[0]).toBe("חדש");
  });
  it("has the five urgencies in order", () => {
    expect([...URGENCIES]).toEqual(["לא חשוב", "חשוב", "חשוב מאוד", "דחוף", "סכנה"]);
  });
  it("has the five responsibilities in order", () => {
    expect([...RESPONSIBILITIES]).toEqual(["החברה", "הוועד", "בעל דירה או שוכר", "אחריות ספק", "לא ידוע"]);
  });
});

describe("badge tokens", () => {
  it("danger urgency is solid red", () => {
    expect(badge("urgency", "סכנה").bg).toBe("#C62828");
  });
  it("overdue maintenance uses the error icon", () => {
    expect(badge("maint", "באיחור").icon).toBe("error");
  });
});
