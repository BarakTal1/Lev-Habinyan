import { describe, expect, it } from "vitest";
import { buildTrend, openByBuilding } from "@/lib/domain/dashboard";

const now = new Date("2026-10-20T09:00:00Z"); // Tuesday 2026-10-20 in Israel. The week starts on Sunday 2026-10-18.

describe("buildTrend", () => {
  it("returns one bucket per week, oldest first, starting on Sunday", () => {
    const r = buildTrend([], now, 3);
    expect(r.map((w) => w.start)).toEqual(["2026-10-04", "2026-10-11", "2026-10-18"]);
    expect(r.map((w) => w.label)).toEqual(["4/10", "11/10", "18/10"]);
    expect(r.every((w) => w.opened === 0 && w.closed === 0)).toBe(true);
  });

  it("counts opened by created_at and closed by closed_at, in Israel time", () => {
    const r = buildTrend(
      [
        { created_at: "2026-10-18T08:00:00Z", closed_at: null },
        // 23:30 UTC on Saturday is Sunday 01:30 in Israel: it belongs to the new week.
        { created_at: "2026-10-17T22:30:00Z", closed_at: "2026-10-19T10:00:00Z" },
        { created_at: "2026-10-12T08:00:00Z", closed_at: "2026-10-13T08:00:00Z" },
      ],
      now,
      2,
    );
    expect(r).toEqual([
      { start: "2026-10-11", label: "11/10", opened: 1, closed: 1 },
      { start: "2026-10-18", label: "18/10", opened: 2, closed: 1 },
    ]);
  });

  it("ignores rows outside the window", () => {
    const r = buildTrend([{ created_at: "2026-01-01T08:00:00Z", closed_at: "2026-01-02T08:00:00Z" }], now, 2);
    expect(r.reduce((s, w) => s + w.opened + w.closed, 0)).toBe(0);
  });
});

describe("openByBuilding", () => {
  it("groups faults by building, largest first, with a label for no building", () => {
    const r = openByBuilding([
      { building: "הירקון 112" }, { building: "דיזנגוף 78" }, { building: "הירקון 112" }, { building: null },
    ]);
    expect(r).toEqual([
      { building: "הירקון 112", count: 2 },
      { building: "דיזנגוף 78", count: 1 },
      { building: "ללא בניין", count: 1 },
    ]);
  });

  it("keeps the top entries only", () => {
    const rows = ["א", "ב", "ג", "ד"].map((b) => ({ building: b }));
    expect(openByBuilding(rows, 2)).toHaveLength(2);
  });
});
