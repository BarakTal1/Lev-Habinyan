import { describe, expect, it } from "vitest";
import { formatILS, parseAmount } from "@/lib/domain/money";

describe("parseAmount", () => {
  it("reads shekels into agorot", () => {
    expect(parseAmount("350")).toBe(35000);
    expect(parseAmount("350.5")).toBe(35050);
    expect(parseAmount("350.50")).toBe(35050);
  });
  it("accepts thousands separators, the shekel sign and the word for shekel", () => {
    expect(parseAmount("₪1,200")).toBe(120000);
    expect(parseAmount("1200 ש\"ח")).toBe(120000);
    expect(parseAmount(" 1 200 ")).toBe(120000);
  });
  it("reads a negative amount (a refund)", () => {
    expect(parseAmount("-50")).toBe(-5000);
  });
  it("returns null for empty or non-numeric text", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12.345")).toBeNull();
  });
});

describe("formatILS", () => {
  it("shows whole shekels without agorot", () => {
    expect(formatILS(35000)).toBe("₪350");
    expect(formatILS(120000)).toBe("₪1,200");
  });
  it("shows agorot when they are not zero", () => {
    expect(formatILS(120050)).toBe("₪1,200.50");
  });
  it("puts the minus sign before the shekel sign", () => {
    expect(formatILS(-5000)).toBe("-₪50");
  });
});
