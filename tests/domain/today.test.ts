import { describe, expect, it } from "vitest";
import { buildToday, type MaintItemRow, type TicketRow } from "@/lib/domain/today";

const now = new Date("2026-10-20T09:00:00Z"); // 12:00 in Israel, 2026-10-20

const item = (o: Partial<MaintItemRow>): MaintItemRow => ({
  id: "m1", building_name: "דיזנגוף 78", system: "בדיקת כיבוי אש", applicable: true,
  last_done_at: "2026-04-08", next_due_at: "2026-10-08", archived_at: null, ...o,
});
const ticket = (o: Partial<TicketRow>): TicketRow => ({
  id: "t1", kind: "task", title: "תשלום לבודק מטפים", building_name: "הירקון 112",
  urgency: "חשוב מאוד", status: "חדש", created_at: "2026-10-01T08:00:00Z",
  first_action_at: null, due_at: "2026-10-19", archived_at: null, ...o,
});

describe("buildToday", () => {
  it("puts overdue maintenance, overdue task and overdue fault in overdue", () => {
    const r = buildToday({
      items: [item({})],
      tickets: [ticket({ id: "t1" }), ticket({ id: "t2", kind: "fault", title: "ראוטר", due_at: "2026-10-18" })],
      now,
    });
    expect(r.overdue.map((x) => x.id).sort()).toEqual(["m1", "t1", "t2"]);
    expect(r.counts.overdue).toBe(3);
  });
  it("excludes archived rows and not-applicable items", () => {
    const r = buildToday({
      items: [item({ archived_at: "2026-10-01T00:00:00Z" }), item({ id: "m2", applicable: false })],
      tickets: [ticket({ archived_at: "2026-10-01T00:00:00Z" })],
      now,
    });
    expect(r.overdue).toHaveLength(0);
    expect(r.counts).toEqual({ overdue: 0, today: 0, openFaults: 0 });
  });
  it("excludes closed tickets", () => {
    const r = buildToday({ items: [], tickets: [ticket({ status: "בוצע" })], now });
    expect(r.overdue).toHaveLength(0);
  });
  it("keeps a company-wide task with no building", () => {
    const r = buildToday({ items: [], tickets: [ticket({ building_name: null })], now });
    expect(r.overdue[0].building).toBeNull();
  });
  it("counts items and tasks due today, and shows them in soon", () => {
    const r = buildToday({
      items: [item({ id: "m3", next_due_at: "2026-10-20" })],
      tickets: [ticket({ id: "t3", due_at: "2026-10-20" })],
      now,
    });
    expect(r.counts.today).toBe(2);
    expect(r.soon.map((x) => x.id)).toEqual(["m3", "t3"].sort());
  });
  it("soon holds items due within 14 days, sorted by date", () => {
    const r = buildToday({
      items: [item({ id: "a", next_due_at: "2026-11-02" }), item({ id: "b", next_due_at: "2026-10-23" }), item({ id: "c", next_due_at: "2026-11-05" })],
      tickets: [], now,
    });
    expect(r.soon.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("open faults sort by urgency then oldest first, with the 24 hour flag", () => {
    const r = buildToday({
      items: [],
      tickets: [
        ticket({ id: "f1", kind: "fault", urgency: "חשוב", due_at: null, created_at: "2026-10-18T09:00:00Z" }),
        ticket({ id: "f2", kind: "fault", urgency: "סכנה", due_at: null, created_at: "2026-10-20T06:00:00Z" }),
        ticket({ id: "f3", kind: "fault", urgency: "חשוב", due_at: null, created_at: "2026-10-17T09:00:00Z" }),
      ],
      now,
    });
    expect(r.faults.map((x) => x.id)).toEqual(["f2", "f3", "f1"]);
    expect(r.faults[1].flagHours).toBeGreaterThanOrEqual(24);
    expect(r.faults[0].flagHours).toBeUndefined();
    expect(r.counts.openFaults).toBe(3);
  });
  it("an overdue fault is in overdue only, but still counted as an open fault", () => {
    const r = buildToday({ items: [], tickets: [ticket({ id: "f9", kind: "fault", due_at: "2026-10-18" })], now });
    expect(r.overdue.map((x) => x.id)).toEqual(["f9"]);
    expect(r.faults).toHaveLength(0);
    expect(r.counts.openFaults).toBe(1);
  });
});
