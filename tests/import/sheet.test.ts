import { describe, expect, it } from "vitest";
import { csvToGrid, decodeCsv, normUnit, parseDate, parseMonth } from "@/lib/import/sheet";

describe("decodeCsv", () => {
  it("reads Hebrew saved by Excel in Windows-1255", () => {
    // דירה,סכום in Windows-1255
    const bytes = new Uint8Array([0xe3, 0xe9, 0xf8, 0xe4, 0x2c, 0xf1, 0xeb, 0xe5, 0xed]);
    expect(decodeCsv(bytes)).toBe("דירה,סכום");
  });
  it("reads UTF-8 and drops the byte order mark", () => {
    const bytes = new TextEncoder().encode("﻿דירה,סכום");
    expect(decodeCsv(bytes)).toBe("דירה,סכום");
  });
});

describe("csvToGrid", () => {
  it("detects the delimiter, trims cells and drops empty rows", () => {
    expect(csvToGrid("דירה;סכום\n 3 ; 350 \n;\n")).toEqual([["דירה", "סכום"], ["3", "350"]]);
  });
  it("keeps a quoted comma inside one cell", () => {
    expect(csvToGrid('דירה,הערה\n3,"שולם, במזומן"')).toEqual([["דירה", "הערה"], ["3", "שולם, במזומן"]]);
  });
});

describe("parseDate", () => {
  it("reads the day first", () => {
    expect(parseDate("1/10/2026")).toBe("2026-10-01");
    expect(parseDate("05.03.26")).toBe("2026-03-05");
    expect(parseDate("2026-10-01")).toBe("2026-10-01");
  });
  it("reads an Excel serial date", () => {
    expect(parseDate("45931")).toBe("2025-10-01");
  });
  it("rejects a date that does not exist", () => {
    expect(parseDate("13/13/2026")).toBeNull();
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("parseMonth", () => {
  it("reads month formats and returns the first day", () => {
    expect(parseMonth("10/2026")).toBe("2026-10-01");
    expect(parseMonth("10.2026")).toBe("2026-10-01");
    expect(parseMonth("2026-10")).toBe("2026-10-01");
    expect(parseMonth("אוקטובר 2026")).toBe("2026-10-01");
    expect(parseMonth("15/10/2026")).toBe("2026-10-01");
  });
  it("returns null for text that is not a month", () => {
    expect(parseMonth("שם דייר")).toBeNull();
    expect(parseMonth("13/2026")).toBeNull();
  });
});

describe("normUnit", () => {
  it("normalizes unit numbers", () => {
    expect(normUnit(" 03 ")).toBe("3");
    expect(normUnit("3 א")).toBe("3א");
    expect(normUnit("12")).toBe("12");
    expect(normUnit("0")).toBe("0");
  });
});
