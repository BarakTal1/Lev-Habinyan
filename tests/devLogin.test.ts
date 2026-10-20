// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { devLoginEnabled } from "@/lib/devLogin";

const keep = { ...process.env };
afterEach(() => { process.env = { ...keep }; });

describe("devLoginEnabled", () => {
  it("is off unless NEXT_PUBLIC_DEV_LOGIN is 1", () => {
    delete process.env.NEXT_PUBLIC_DEV_LOGIN;
    expect(devLoginEnabled()).toBe(false);
  });
  it("is on locally when the flag is 1", () => {
    process.env.NEXT_PUBLIC_DEV_LOGIN = "1";
    delete process.env.VERCEL;
    expect(devLoginEnabled()).toBe(true);
  });
  it("is always off on Vercel, even with the flag set", () => {
    process.env.NEXT_PUBLIC_DEV_LOGIN = "1";
    process.env.VERCEL = "1";
    expect(devLoginEnabled()).toBe(false);
  });
});
