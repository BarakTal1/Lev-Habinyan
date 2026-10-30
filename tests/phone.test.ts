import { describe, expect, it } from "vitest";
import { telLink, waLink, isPhone } from "@/lib/phone";

describe("waLink", () => {
  it("turns a local mobile number into a wa.me link", () => expect(waLink("052-6630418")).toBe("https://wa.me/972526630418"));
  it("accepts a number that starts with +972", () => expect(waLink("+972-52-663-0418")).toBe("https://wa.me/972526630418"));
  it("keeps a number that already starts with 972", () => expect(waLink("972526630418")).toBe("https://wa.me/972526630418"));
  it("returns null for an empty or missing number", () => {
    expect(waLink("")).toBeNull();
    expect(waLink(null)).toBeNull();
  });
});

describe("telLink", () => {
  it("keeps digits and a leading plus only", () => expect(telLink("052-663 0418")).toBe("tel:0526630418"));
  it("returns null when there is no number", () => expect(telLink(undefined)).toBeNull());
});

describe("isPhone", () => {
  it("accepts Israeli mobile and landline numbers in common forms", () => {
    expect(isPhone("052-1234567")).toBe(true);
    expect(isPhone("+972 52 123 4567")).toBe(true);
    expect(isPhone("03-5551234")).toBe(true);
  });
  it("rejects short or foreign-looking text", () => {
    expect(isPhone("12")).toBe(false);
    expect(isPhone("abc")).toBe(false);
  });
});
