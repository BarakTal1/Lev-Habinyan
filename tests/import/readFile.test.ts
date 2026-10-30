import { describe, expect, it } from "vitest";
import { cellText } from "@/lib/import/readFile";

describe("cellText", () => {
  it("turns spreadsheet cells into text the sheet parsers read", () => {
    expect(cellText("דירה")).toBe("דירה");
    expect(cellText(350.5)).toBe("350.5");
    expect(cellText(null)).toBe("");
    expect(cellText(true)).toBe("true");
    expect(cellText(new Date(Date.UTC(2026, 9, 5)))).toBe("2026-10-05");
  });
});
