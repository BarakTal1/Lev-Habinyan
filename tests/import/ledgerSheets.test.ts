import { describe, expect, it } from "vitest";
import { parsePaymentsSheet, parseTariffSheet } from "@/lib/import/ledgerSheets";

describe("parseTariffSheet", () => {
  it("reads one row per apartment and month, and ignores the name column", () => {
    const r = parseTariffSheet([["דירה", "שם דייר", "01/2026", "02/2026"], ["3", "כהן", "350", "350"]]);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { row: 2, unit: "3", month: "2026-01-01", amount: 35000 },
      { row: 2, unit: "3", month: "2026-02-01", amount: 35000 },
    ]);
  });
  it("skips an empty month cell and reports a bad amount", () => {
    const r = parseTariffSheet([["מספר דירה", "01/2026", "02/2026"], ["4", "", "abc"]]);
    expect(r.rows).toEqual([]);
    expect(r.problems).toEqual([{ row: 2, column: "02/2026", reason: "סכום לא תקין" }]);
  });
  it("reports a missing apartment column on row 1", () => {
    const r = parseTariffSheet([["שם", "01/2026"], ["כהן", "350"]]);
    expect(r.rows).toEqual([]);
    expect(r.problems).toEqual([{ row: 1, column: "דירה", reason: "חסרה עמודה" }]);
  });
});

describe("parsePaymentsSheet", () => {
  const header = ["דירה", "סכום", "תאריך תשלום", "חודש", "אמצעי תשלום", "אסמכתא"];

  it("reads a payment row", () => {
    const r = parsePaymentsSheet([header, ["03", "₪350", "05/10/2026", "10/2026", "אשראי", "A-17"]]);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([{ row: 2, unit: "3", amount: 35000, paidAt: "2026-10-05", month: "2026-10-01", method: "card", reference: "A-17" }]);
  });
  it("maps payment methods and allows empty optional cells", () => {
    const r = parsePaymentsSheet([["דירה", "סכום", "תאריך", "אמצעי תשלום"], ["1", "100", "1/10/2026", "העברה בנקאית"], ["2", "100", "1/10/2026", "צ'ק"], ["3", "100", "1/10/2026", "משהו"]]);
    expect(r.rows.map((x) => x.method)).toEqual(["transfer", "check", "other"]);
    expect(r.rows[0].month).toBeNull();
    expect(r.rows[0].reference).toBeNull();
  });
  it("reports a bad amount and skips the row", () => {
    const r = parsePaymentsSheet([header, ["3", "abc", "05/10/2026", "", "", ""]]);
    expect(r.rows).toEqual([]);
    expect(r.problems).toEqual([{ row: 2, column: "סכום", reason: "סכום לא תקין" }]);
  });
  it("reports a bad date", () => {
    const r = parsePaymentsSheet([header, ["3", "350", "32/10/2026", "", "", ""]]);
    expect(r.problems).toEqual([{ row: 2, column: "תאריך תשלום", reason: "תאריך לא תקין" }]);
  });
  it("reports each missing required column on row 1", () => {
    const r = parsePaymentsSheet([["סכום"], ["350"]]);
    expect(r.problems.map((p) => p.column)).toEqual(["דירה", "תאריך תשלום"]);
  });
});

describe("parseTariffSheet: columns that are not months", () => {
  it("reports a header that is not a month when its column has amounts", () => {
    const r = parseTariffSheet([["דירה", "ינואר", "02/2026"], ["3", "350", "350"]]);
    expect(r.rows).toHaveLength(1);
    expect(r.problems).toEqual([{ row: 1, column: "ינואר", reason: "כותרת לא מובנת כחודש" }]);
  });
  it("does not report a text column such as the tenant name", () => {
    const r = parseTariffSheet([["דירה", "שם דייר", "02/2026"], ["3", "כהן", "350"]]);
    expect(r.problems).toEqual([]);
  });
  it("reports a sheet with no month column", () => {
    const r = parseTariffSheet([["דירה", "שם"], ["3", "כהן"]]);
    expect(r.problems).toEqual([{ row: 1, column: "חודש", reason: "חסרה עמודת חודש" }]);
  });
});
