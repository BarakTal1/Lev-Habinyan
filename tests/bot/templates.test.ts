import { describe, expect, it } from "vitest";
import { TEMPLATES, buildPreview, isInsideWindow, statusPreviewKind } from "@/lib/bot/templates";

const now = new Date("2026-10-26T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const H = 3600_000;
const M = 60_000;

describe("isInsideWindow", () => {
  it("is inside at 23h59m", () => expect(isInsideWindow(ago(24 * H - M), now)).toBe(true));
  it("is outside at 24h01m", () => expect(isInsideWindow(ago(24 * H + M), now)).toBe(false));
  it("is outside at exactly 24h", () => expect(isInsideWindow(ago(24 * H), now)).toBe(false));
  it("is outside for null", () => expect(isInsideWindow(null, now)).toBe(false));
  it("is inside for a future timestamp", () => expect(isInsideWindow(new Date(now.getTime() + H), now)).toBe(true));
});

describe("buildPreview", () => {
  const inside = ago(H);
  const t = { number: 42, residentName: "דנה", visit: { date: "27.10", from: "09:00", to: "11:00" }, question: "מה הקומה?" };

  it("builds assigned", () => {
    const p = buildPreview("assigned", t, inside, now);
    expect(p.template).toBe("ticket_assigned");
    expect(p.params).toEqual(["דנה", "42"]);
    expect(p.text).toBe("שלום דנה, פנייה 42 התקבלה ושויכה לטיפול. נעדכן כשיש מועד.");
    expect(p.editable).toBe(true);
  });
  it("builds visit", () => {
    const p = buildPreview("visit", t, inside, now);
    expect(p.template).toBe("ticket_visit");
    expect(p.params).toEqual(["42", "27.10", "09:00", "11:00"]);
    expect(p.text).toBe("פנייה 42: נציג יגיע ב-27.10 בין 09:00 ל-11:00.");
  });
  it("builds done with buttons", () => {
    const p = buildPreview("done", t, inside, now);
    expect(p.template).toBe("ticket_done");
    expect(p.params).toEqual(["42"]);
    expect(p.text).toBe("פנייה 42 טופלה. הכול תקין?");
    expect(p.buttons).toEqual([
      { id: "done_yes:42", title: "כן" },
      { id: "done_no:42", title: "לא, לפתוח מחדש" },
    ]);
  });
  it("builds info", () => {
    const p = buildPreview("info", t, inside, now);
    expect(p.template).toBe("ticket_info");
    expect(p.params).toEqual(["42", "מה הקומה?"]);
    expect(p.text).toBe("לגבי פנייה 42: מה הקומה?");
  });
  it("is editable only inside the window", () => {
    expect(buildPreview("done", t, ago(25 * H), now).editable).toBe(false);
    expect(buildPreview("done", t, null, now).editable).toBe(false);
  });
});

describe("catalog", () => {
  it("ticket_done has 2 buttons with short titles", () => {
    const b = TEMPLATES.ticket_done.buttons!;
    expect(b).toHaveLength(2);
    for (const x of b) expect(x.title.length).toBeLessThanOrEqual(20);
  });
});

describe("statusPreviewKind", () => {
  it("maps statuses", () => {
    expect(statusPreviewKind("הוקצה")).toBe("assigned");
    expect(statusPreviewKind("בוצע")).toBe("done");
    expect(statusPreviewKind("בטיפול")).toBeNull();
    expect(statusPreviewKind("חדש")).toBeNull();
  });
});
