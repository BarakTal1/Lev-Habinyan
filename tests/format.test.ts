import { describe, expect, it } from "vitest";
import { ageLabel, dueLabel } from "@/lib/format";

describe("dueLabel", () => {
  const today = "2026-10-20";
  it("late by 1 day", () => expect(dueLabel("2026-10-19", today)).toEqual({ text: "יום איחור", late: true }));
  it("late by 2 days", () => expect(dueLabel("2026-10-18", today)).toEqual({ text: "יומיים איחור", late: true }));
  it("late by 12 days", () => expect(dueLabel("2026-10-08", today)).toEqual({ text: "12 ימי איחור", late: true }));
  it("today", () => expect(dueLabel(today, today)).toEqual({ text: "היום", late: false }));
  it("tomorrow", () => expect(dueLabel("2026-10-21", today)).toEqual({ text: "מחר", late: false }));
  it("in 3 days", () => expect(dueLabel("2026-10-23", today)).toEqual({ text: "בעוד 3 ימים", late: false }));
  it("no date", () => expect(dueLabel(null, today)).toEqual({ text: "", late: false }));
});

describe("ageLabel", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  it("under an hour", () => expect(ageLabel(ago(0.5), now)).toBe("לפני פחות משעה"));
  it("one hour", () => expect(ageLabel(ago(1), now)).toBe("לפני שעה"));
  it("two hours", () => expect(ageLabel(ago(2), now)).toBe("לפני שעתיים"));
  it("26 hours", () => expect(ageLabel(ago(26), now)).toBe("לפני 26 שעות"));
  it("two days", () => expect(ageLabel(ago(50), now)).toBe("לפני יומיים"));
  it("three days", () => expect(ageLabel(ago(75), now)).toBe("לפני 3 ימים"));
});
