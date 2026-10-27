import { describe, expect, it } from "vitest";
import { buildEvents, eventsByDay, isMonth, monthGrid, shiftMonth, type CalItem, type CalTicket } from "@/lib/domain/calendar";
import { googleAddUrl, toIcs } from "@/lib/domain/ics";

const ticket = (over: Partial<CalTicket> = {}): CalTicket => ({
  id: "t1", number: 1, kind: "fault", title: "נזילה", urgency: "דחוף", status: "חדש",
  created_at: "2026-10-20T10:00:00Z", due_at: null, scheduled_at: null, building_name: "ויצמן 9", ...over,
});
const item = (over: Partial<CalItem> = {}): CalItem => ({ id: "m1", building_id: "b1", system: "בדיקת מעלית", applicable: true, next_due_at: "2026-11-03", building_name: "ויצמן 9", ...over });

describe("buildEvents", () => {
  it("makes an opened event for a fault and none for a task", () => {
    expect(buildEvents([ticket()], []).map((e) => e.kind)).toEqual(["opened"]);
    expect(buildEvents([ticket({ kind: "task" })], [])).toEqual([]);
  });
  it("makes a due event and a timed visit event in Israel time", () => {
    const ev = buildEvents([ticket({ kind: "task", due_at: "2026-10-30", scheduled_at: "2026-10-28T06:30:00Z" })], []);
    expect(ev.find((e) => e.kind === "due")?.date).toBe("2026-10-30");
    const visit = ev.find((e) => e.kind === "visit");
    expect(visit).toMatchObject({ date: "2026-10-28", time: "08:30" });
  });
  it("marks closed tickets as done", () => {
    expect(buildEvents([ticket({ status: "בוצע" })], [])[0].done).toBe(true);
  });
  it("adds maintenance dates and skips items that do not apply or have no date", () => {
    const ev = buildEvents([], [item(), item({ id: "m2", applicable: false }), item({ id: "m3", next_due_at: null })]);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: "maintenance", href: "/maintenance/b1" });
  });
});

describe("eventsByDay", () => {
  it("puts timed events first inside a day", () => {
    const ev = buildEvents([ticket({ kind: "task", due_at: "2026-10-28", scheduled_at: "2026-10-28T06:30:00Z" })], []);
    expect(eventsByDay(ev)["2026-10-28"].map((e) => e.kind)).toEqual(["visit", "due"]);
  });
});

describe("monthGrid", () => {
  it("starts on Sunday and covers the whole month", () => {
    const weeks = monthGrid("2026-10");
    expect(weeks[0][0]).toBe("2026-09-27");
    expect(weeks.flat()).toContain("2026-10-31");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks).toHaveLength(5);
  });
  it("uses six weeks when the month needs them", () => {
    expect(monthGrid("2026-11")).toHaveLength(5);
    expect(monthGrid("2027-05")).toHaveLength(6);
  });
});

describe("month helpers", () => {
  it("shifts across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("validates a month string", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
  });
});

describe("toIcs", () => {
  const events = buildEvents([ticket({ kind: "task", title: "תיקון; שער, חניה", due_at: "2026-10-30", scheduled_at: "2026-10-28T06:30:00Z" })], [item()]);
  const ics = toIcs(events, new Date("2026-10-27T12:00:00Z"), "https://x.test");
  it("has the calendar frame and CRLF lines", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("writes a UTC time for a visit and a date for an all-day event", () => {
    expect(ics).toContain("DTSTART:20261028T063000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261030");
    expect(ics).toContain("DTEND;VALUE=DATE:20261031");
  });
  it("escapes commas and semicolons", () => {
    expect(ics.replace(/\r\n /g, "")).toContain("תיקון\; שער\\, חניה");
  });
  it("folds long lines at 75 bytes", () => {
    const long = buildEvents([], [item({ system: "א".repeat(80) })]);
    const lines = toIcs(long, new Date(), "https://x.test").split("\r\n");
    const enc = new TextEncoder();
    expect(lines.every((l) => enc.encode(l).length <= 75)).toBe(true);
  });
  it("skips the opened events", () => {
    expect(toIcs(buildEvents([ticket()], []), new Date(), "https://x.test")).not.toContain("BEGIN:VEVENT");
  });
});

describe("googleAddUrl", () => {
  it("builds a Google Calendar template link", () => {
    const [e] = buildEvents([], [item()]);
    const url = new URL(googleAddUrl(e, "https://x.test"));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261103/20261104");
    expect(url.searchParams.get("text")).toContain("בדיקת מעלית");
  });
});
