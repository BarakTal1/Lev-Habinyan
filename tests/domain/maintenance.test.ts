import { describe, expect, it } from "vitest";
import { addFrequency, completeItem, maintenanceState } from "@/lib/domain/maintenance";

const today = "2026-10-20";
const item = (o: Partial<{ applicable: boolean; last_done_at: string | null; next_due_at: string | null }>) => ({
  applicable: true, last_done_at: "2026-04-08", next_due_at: null, ...o,
});

describe("maintenanceState", () => {
  it("not applicable is na", () => expect(maintenanceState(item({ applicable: false }), today)).toBe("na"));
  it("no last and no next is nodata", () => expect(maintenanceState(item({ last_done_at: null }), today)).toBe("nodata"));
  it("next in the past is overdue", () => expect(maintenanceState(item({ next_due_at: "2026-10-08" }), today)).toBe("overdue"));
  it("next within 14 days is soon", () => expect(maintenanceState(item({ next_due_at: "2026-10-30" }), today)).toBe("soon"));
  it("next far away is ok", () => expect(maintenanceState(item({ next_due_at: "2026-11-10" }), today)).toBe("ok"));
  it("next exactly today plus 14 is soon", () => expect(maintenanceState(item({ next_due_at: "2026-11-03" }), today)).toBe("soon"));
  it("next today plus 15 is ok", () => expect(maintenanceState(item({ next_due_at: "2026-11-04" }), today)).toBe("ok"));
  it("next due today is soon, not overdue", () => expect(maintenanceState(item({ next_due_at: today }), today)).toBe("soon"));
  it("has a last date but no next date is nodata", () => expect(maintenanceState(item({ next_due_at: null }), today)).toBe("nodata"));
});

describe("addFrequency", () => {
  it("clamps Jan 31 plus 1 month to Feb 28", () => expect(addFrequency("2026-01-31", "month", 1)).toBe("2026-02-28"));
  it("clamps to Feb 29 in a leap year", () => expect(addFrequency("2024-01-31", "month", 1)).toBe("2024-02-29"));
  it("adds weeks", () => expect(addFrequency("2026-10-20", "week", 2)).toBe("2026-11-03"));
  it("adds days", () => expect(addFrequency("2026-10-20", "day", 10)).toBe("2026-10-30"));
  it("adds a year", () => expect(addFrequency("2026-02-28", "year", 1)).toBe("2027-02-28"));
  it("clamps Feb 29 plus 1 year to Feb 28", () => expect(addFrequency("2024-02-29", "year", 1)).toBe("2025-02-28"));
});

describe("completeItem", () => {
  it("sets the next date from the frequency", () => {
    expect(completeItem({ frequency_unit: "month", frequency_count: 6 }, "2026-10-08")).toEqual({
      last_done_at: "2026-10-08", next_due_at: "2027-04-08",
    });
  });
  it("keeps next date empty when there is no frequency", () => {
    expect(completeItem({ frequency_unit: null, frequency_count: null }, "2026-10-08")).toEqual({
      last_done_at: "2026-10-08", next_due_at: null,
    });
  });
});
