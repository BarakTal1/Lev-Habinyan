import { describe, expect, it } from "vitest";
import { hoursWithoutAction, isOpen } from "@/lib/domain/tickets";

const now = new Date("2026-10-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe("isOpen", () => {
  it("done and cancelled are closed", () => {
    expect(isOpen("בוצע")).toBe(false);
    expect(isOpen("בוטל")).toBe(false);
  });
  it("new, in progress and reopened are open", () => {
    for (const s of ["חדש", "בטיפול", "נפתח מחדש", "הוקצה", "ממתין"]) expect(isOpen(s)).toBe(true);
  });
});

describe("hoursWithoutAction", () => {
  const fault = { kind: "fault" as const, status: "חדש", created_at: hoursAgo(26), first_action_at: null };
  it("flags an open fault older than 24 hours with no first action", () => expect(hoursWithoutAction(fault, now)).toBe(26));
  it("returns null once there was a first action", () => expect(hoursWithoutAction({ ...fault, first_action_at: hoursAgo(1) }, now)).toBeNull());
  it("returns null for a task", () => expect(hoursWithoutAction({ ...fault, kind: "task", created_at: hoursAgo(30) }, now)).toBeNull());
  it("returns null for a closed fault", () => expect(hoursWithoutAction({ ...fault, status: "בוצע" }, now)).toBeNull());
  it("returns null under 24 hours", () => expect(hoursWithoutAction({ ...fault, created_at: hoursAgo(5) }, now)).toBeNull());
});
