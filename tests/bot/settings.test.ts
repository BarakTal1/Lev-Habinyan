import { describe, expect, it } from "vitest";
import { hoursText, isWithinHours, parseBotSettings } from "@/lib/bot/settings";

// 2026-11-01 is a Sunday. Israel is UTC+2 in November, UTC+3 in summer.
const hours = { days: [0, 1, 2, 3, 4], from: "08:00", to: "18:00" };

describe("isWithinHours", () => {
  it("is true on a working day inside the hours, in Israel time", () => {
    expect(isWithinHours(hours, new Date("2026-11-01T08:00:00Z"))).toBe(true); // Sunday 10:00
  });
  it("is false on Friday and Saturday", () => {
    expect(isWithinHours(hours, new Date("2026-11-06T08:00:00Z"))).toBe(false); // Friday 10:00
    expect(isWithinHours(hours, new Date("2026-11-07T08:00:00Z"))).toBe(false); // Saturday 10:00
  });
  it("includes the opening minute and excludes the closing minute", () => {
    expect(isWithinHours(hours, new Date("2026-11-01T06:00:00Z"))).toBe(true);  // 08:00
    expect(isWithinHours(hours, new Date("2026-11-01T05:59:00Z"))).toBe(false); // 07:59
    expect(isWithinHours(hours, new Date("2026-11-01T15:59:00Z"))).toBe(true);  // 17:59
    expect(isWithinHours(hours, new Date("2026-11-01T16:00:00Z"))).toBe(false); // 18:00
  });
  it("uses Israel summer time too", () => {
    expect(isWithinHours(hours, new Date("2026-07-05T04:59:00Z"))).toBe(false); // Sunday 07:59 (UTC+3)
    expect(isWithinHours(hours, new Date("2026-07-05T05:00:00Z"))).toBe(true);  // 08:00
  });
  it("is always open when no hours are set", () => {
    expect(isWithinHours(null, new Date("2026-11-07T23:00:00Z"))).toBe(true);
  });
  it("a late Saturday night in UTC that is already Sunday in Israel counts as Sunday", () => {
    expect(isWithinHours(hours, new Date("2026-10-31T22:30:00Z"))).toBe(false); // Sunday 00:30: before opening
    expect(isWithinHours({ ...hours, from: "00:00" }, new Date("2026-10-31T22:30:00Z"))).toBe(true);
  });
});

describe("hoursText", () => {
  it("writes a run of days as a range", () => {
    expect(hoursText(hours)).toBe("ימים א׳–ה׳, 08:00–18:00");
  });
  it("lists days that are not in a row", () => {
    expect(hoursText({ days: [0, 2, 4], from: "09:00", to: "17:00" })).toBe("ימים א׳, ג׳, ה׳, 09:00–17:00");
  });
  it("is empty when no hours are set", () => {
    expect(hoursText(null)).toBe("");
  });
});

describe("parseBotSettings", () => {
  const ok = { days: ["0", "1", "2"], from: "08:00", to: "17:30", emergency: "100", oncall: "052-1234567\n+972 54 7654321, 0501112222" };

  it("reads the form into the stored settings", () => {
    const r = parseBotSettings(ok);
    expect(r).toEqual({ ok: true, value: { hours: { days: [0, 1, 2], from: "08:00", to: "17:30" }, emergencyNumber: "100", oncallPhones: ["052-1234567", "+972 54 7654321", "0501112222"] } });
  });
  it("no day chosen means always open", () => {
    expect(parseBotSettings({ ...ok, days: [] })).toMatchObject({ ok: true, value: { hours: null } });
  });
  it("an empty emergency number is stored as null", () => {
    expect(parseBotSettings({ ...ok, emergency: "  " })).toMatchObject({ ok: true, value: { emergencyNumber: null } });
  });
  it("sorts the days and drops repeats and values that are not a day", () => {
    expect(parseBotSettings({ ...ok, days: ["3", "1", "1", "9", "x"] })).toMatchObject({ value: { hours: { days: [1, 3] } } });
  });
  it("rejects hours that do not close after they open, or that are not times", () => {
    expect(parseBotSettings({ ...ok, from: "18:00", to: "08:00" })).toEqual({ ok: false, error: "hours" });
    expect(parseBotSettings({ ...ok, from: "8", to: "17:00" })).toEqual({ ok: false, error: "hours" });
    expect(parseBotSettings({ ...ok, from: "08:00", to: "25:00" })).toEqual({ ok: false, error: "hours" });
  });
  it("rejects an emergency number that is not a number", () => {
    expect(parseBotSettings({ ...ok, emergency: "call us" })).toEqual({ ok: false, error: "emergency" });
  });
  it("rejects an on-call phone that is not a phone", () => {
    expect(parseBotSettings({ ...ok, oncall: "052-1234567\n12" })).toEqual({ ok: false, error: "oncall" });
  });
  it("removes a phone that is written twice", () => {
    expect(parseBotSettings({ ...ok, oncall: "052-1234567, 0521234567, +972521234567" })).toMatchObject({ value: { oncallPhones: ["052-1234567"] } });
  });
});
