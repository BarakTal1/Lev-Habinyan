import { describe, expect, it } from "vitest";
import { plaqueSpec, splitAddress, streetCode } from "@/lib/plaque";

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

describe("streetCode", () => {
  it("uses initials for several words", () => {
    expect(streetCode("אבא אחימאיר")).toBe("אא");
  });
  it("uses three letters for one word", () => {
    expect(streetCode("דיזנגוף")).toBe("דיז");
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
    expect(a.code).not.toBe(b.code);
  });
  it("tells apart the five demo buildings by code and number", () => {
    const names = ["אבא אחימאיר 5", "דיזנגוף 78", "הירקון 112", "ויצמן 9", "סוקולוב 24"];
    const keys = names.map((n) => { const p = plaqueSpec(n); return `${p.code}${p.number}`; });
    expect(new Set(keys).size).toBe(names.length);
  });
  it("trims spaces before it picks a color", () => {
    expect(plaqueSpec("  ויצמן 9 ").color).toBe(plaqueSpec("ויצמן 9").color);
  });
});
