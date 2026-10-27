import { describe, expect, it } from "vitest";
import { splitAddress } from "@/lib/address";
import { waitLabel } from "@/lib/format";

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

describe("waitLabel", () => {
  it("uses hours under two days", () => {
    expect(waitLabel(30)).toBe("30 שעות ללא טיפול");
  });
  it("uses days from two days", () => {
    expect(waitLabel(129)).toBe("5 ימים ללא טיפול");
  });
});
