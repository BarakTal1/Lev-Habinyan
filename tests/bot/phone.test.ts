import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/bot/phone";

describe("normalizePhone", () => {
  it("writes every form of one mobile number the same way", () => {
    expect(normalizePhone("052-123 4567")).toBe("972521234567");
    expect(normalizePhone("+972 52 1234567")).toBe("972521234567");
    expect(normalizePhone("972521234567")).toBe("972521234567");
  });
  it("turns a landline that starts with 0 into 972", () => {
    expect(normalizePhone("03-1234567")).toBe("97231234567");
  });
  it("returns null for empty input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});
