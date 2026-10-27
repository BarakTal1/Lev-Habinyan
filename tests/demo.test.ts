import { afterEach, describe, expect, it } from "vitest";
import { demoModeEnabled } from "@/lib/demo";

describe("demoModeEnabled", () => {
  afterEach(() => {
    delete process.env.DEMO_EMAIL;
    delete process.env.DEMO_PASSWORD;
  });

  it("is off when no variable is set", () => {
    expect(demoModeEnabled()).toBe(false);
  });

  it("is off when only the email is set", () => {
    process.env.DEMO_EMAIL = "demo@lev.local";
    expect(demoModeEnabled()).toBe(false);
  });

  it("is on when both variables are set", () => {
    process.env.DEMO_EMAIL = "demo@lev.local";
    process.env.DEMO_PASSWORD = "x";
    expect(demoModeEnabled()).toBe(true);
  });
});
