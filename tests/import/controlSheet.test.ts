import { describe, expect, it } from "vitest";
import { parseControlSheet, summarizeImport } from "@/lib/import/controlSheet";

const header = "בניין,ניקיון,גינון,מעלית,כיבוי אש,הדברה,חשמל,אינסטלציה,ביוב,גג,משאבות,מים,שער";
const csv = (...rows: string[]) => [header, ...rows].join("\n");
const cell = (rows: ReturnType<typeof parseControlSheet>["rows"], b: string, system: string) => rows.find((r) => r.building === b && r.system === system)!;

describe("parseControlSheet", () => {
  it("returns one row per building and system", () => {
    const r = parseControlSheet(csv("הירקון 112,,,,,,,,,,,,"));
    expect(r.rows).toHaveLength(12);
    expect(r.problems).toEqual([]);
  });
  it("a dash means the system does not apply", () => {
    const r = parseControlSheet(csv("הירקון 112,-,,,,,,,,,,,"));
    expect(cell(r.rows, "הירקון 112", "ניקיון").applicable).toBe(false);
  });
  it("an empty cell is applicable with no data", () => {
    const r = parseControlSheet(csv("הירקון 112,,,,,,,,,,,,"));
    const c = cell(r.rows, "הירקון 112", "גינון");
    expect(c).toMatchObject({ applicable: true });
    expect(c.last_done_at).toBeUndefined();
    expect(c.frequency_unit).toBeUndefined();
  });
  it("שבועי is every 1 week", () => {
    const c = cell(parseControlSheet(csv("הירקון 112,שבועי,,,,,,,,,,,")).rows, "הירקון 112", "ניקיון");
    expect(c).toMatchObject({ frequency_unit: "week", frequency_count: 1 });
  });
  it("כל שבועיים is every 2 weeks", () => {
    const c = cell(parseControlSheet(csv("הירקון 112,כל שבועיים,,,,,,,,,,,")).rows, "הירקון 112", "ניקיון");
    expect(c).toMatchObject({ frequency_unit: "week", frequency_count: 2 });
  });
  it("חצי שנתי is every 6 months and רבעוני every 3 months", () => {
    const r = parseControlSheet(csv("הירקון 112,,,חצי שנתי,,רבעוני,,,,,,,")).rows;
    expect(cell(r, "הירקון 112", "בדיקת מעלית")).toMatchObject({ frequency_unit: "month", frequency_count: 6 });
    expect(cell(r, "הירקון 112", "הדברה")).toMatchObject({ frequency_unit: "month", frequency_count: 3 });
  });
  it("a date cell is the last done date", () => {
    const r = parseControlSheet(csv("הירקון 112,,,08.04.26,,,,,,,,,")).rows;
    expect(cell(r, "הירקון 112", "בדיקת מעלית").last_done_at).toBe("2026-04-08");
  });
  it("a cell with a frequency and a date gives both", () => {
    const r = parseControlSheet(csv("הירקון 112,,,,חצי שנתי 08/04/2026,,,,,,,,")).rows;
    expect(cell(r, "הירקון 112", "בדיקת כיבוי אש")).toMatchObject({ frequency_unit: "month", frequency_count: 6, last_done_at: "2026-04-08" });
  });
  it("an unrecognized cell goes to problems and not into the data", () => {
    const r = parseControlSheet(csv("הירקון 112,,,בערך פעם בחורף,,,,,,,,,"));
    expect(r.problems).toEqual([{ row: 2, column: "מעלית", reason: expect.any(String) }]);
    const c = cell(r.rows, "הירקון 112", "בדיקת מעלית");
    expect(c.frequency_unit).toBeUndefined();
    expect(c.last_done_at).toBeUndefined();
  });
  it("an unknown column header is a problem and its cells are ignored", () => {
    const r = parseControlSheet("בניין,ניקיון,חלל\nהירקון 112,שבועי,שבועי");
    expect(r.problems.some((p) => p.column === "חלל")).toBe(true);
    expect(r.rows.filter((x) => x.building === "הירקון 112")).toHaveLength(12);
  });
  it("accepts semicolons, a BOM and quoted cells", () => {
    const r = parseControlSheet("﻿בניין;ניקיון\n\"הירקון 112\";\"שבועי\"");
    expect(cell(r.rows, "הירקון 112", "ניקיון")).toMatchObject({ frequency_unit: "week", frequency_count: 1 });
  });
  it("skips blank lines and rows with no building name", () => {
    const r = parseControlSheet(csv("", ",שבועי,,,,,,,,,,,", "ויצמן 9,,,,,,,,,,,,"));
    expect(new Set(r.rows.map((x) => x.building))).toEqual(new Set(["ויצמן 9"]));
  });
});

describe("summarizeImport", () => {
  it("lists new and existing buildings", () => {
    const { rows } = parseControlSheet(csv("הירקון 112,,,,,,,,,,,,", "בניין חדש,,,,,,,,,,,,"));
    const s = summarizeImport(rows, ["הירקון 112", "אחר"]);
    expect(s.buildings).toEqual([{ name: "הירקון 112", isNew: false }, { name: "בניין חדש", isNew: true }]);
    expect(s.items).toBe(24);
  });
});
