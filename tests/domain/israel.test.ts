import { describe, expect, it } from "vitest";
import { daysBetween, formatDate, todayIL } from "@/lib/israel";

describe("israel dates", () => {
  it("todayIL is already the next day after midnight in Israel", () => {
    expect(todayIL(new Date("2026-10-19T21:30:00Z"))).toBe("2026-10-20");
  });
  it("todayIL is still the same day before midnight in Israel", () => {
    expect(todayIL(new Date("2026-10-19T20:30:00Z"))).toBe("2026-10-19");
  });
  it("formatDate gives DD.MM.YY", () => {
    expect(formatDate("2026-10-08")).toBe("08.10.26");
  });
  it("daysBetween counts whole days, negative when going back", () => {
    expect(daysBetween("2026-10-20", "2026-11-03")).toBe(14);
    expect(daysBetween("2026-10-20", "2026-10-08")).toBe(-12);
  });
});
