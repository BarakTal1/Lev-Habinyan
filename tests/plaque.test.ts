import { describe, expect, it } from "vitest";
import { fitFontSize, plaqueSpec, splitAddress } from "@/lib/plaque";

describe("splitAddress", () => {
  it("splits a street and a number", () => {
    expect(splitAddress("דיזנגוף 78")).toEqual({ street: "דיזנגוף", number: "78" });
  });
  it("keeps a street with two words", () => {
    expect(splitAddress("אבא אחימאיר 5")).toEqual({ street: "אבא אחימאיר", number: "5" });
  });
  it("accepts a letter after the number", () => {
    expect(splitAddress("הירקון 112א")).toEqual({ street: "הירקון", number: "112א" });
  });
  it("returns no number when the name has none", () => {
    expect(splitAddress("מגדלי הים")).toEqual({ street: "מגדלי הים", number: null });
  });
});

describe("fitFontSize", () => {
  it("keeps the largest size for a short street", () => {
    expect(fitFontSize("ויצמן", 62, 11)).toBe(11);
  });
  it("shrinks a long street so it fits one line", () => {
    const size = fitFontSize("אבא אחימאיר", 62, 11);
    expect(size).toBeLessThan(11);
    expect(size * 0.52 * 11).toBeLessThanOrEqual(62.5);
  });
  it("never goes below the minimum", () => {
    expect(fitFontSize("רחוב ארוך מאוד מאוד מאוד מאוד", 62, 11)).toBe(7.5);
  });
});

describe("plaqueSpec", () => {
  it("gives the same plaque for the same name", () => {
    expect(plaqueSpec("דיזנגוף 78")).toEqual(plaqueSpec("דיזנגוף 78"));
  });
  it("tells two buildings with the same number apart", () => {
    const a = plaqueSpec("ויצמן 5");
    const b = plaqueSpec("הירקון 5");
    expect(a.number).toBe(b.number);
    expect(a.street).not.toBe(b.street);
  });
  it("trims spaces before it picks a color", () => {
    expect(plaqueSpec("  ויצמן 9 ").color).toBe(plaqueSpec("ויצמן 9").color);
  });
});
