import { describe, expect, it } from "vitest";
import { daysBetween, formatDate, israelLocalToIso, isoToIsraelLocal, todayIL } from "@/lib/israel";

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

describe("israel local time conversion", () => {
  it("winter: 09:30 in Israel is 07:30 UTC", () => expect(israelLocalToIso("2026-12-02T09:30")).toBe("2026-12-02T07:30:00.000Z"));
  it("summer: 09:30 in Israel is 06:30 UTC", () => expect(israelLocalToIso("2026-07-02T09:30")).toBe("2026-07-02T06:30:00.000Z"));
  it("converts back for a datetime-local input", () => expect(isoToIsraelLocal("2026-12-02T07:30:00.000Z")).toBe("2026-12-02T09:30"));
  it("round trips around the clock change", () => {
    for (const local of ["2026-03-27T12:00", "2026-10-25T12:00", "2026-10-26T00:15"]) expect(isoToIsraelLocal(israelLocalToIso(local))).toBe(local);
  });
  it("rejects a bad value", () => expect(() => israelLocalToIso("hello")).toThrow());
});
