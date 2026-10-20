import { URGENCIES } from "@/lib/labels";
import { addDays, daysBetween, todayIL } from "@/lib/israel";
import { SOON_DAYS, maintenanceState } from "./maintenance";
import { hoursWithoutAction, isOpen } from "./tickets";

export type MaintItemRow = {
  id: string; building_name: string | null; system: string; applicable: boolean;
  last_done_at: string | null; next_due_at: string | null; archived_at: string | null;
};
export type TicketRow = {
  id: string; kind: "fault" | "task"; title: string; building_name: string | null;
  urgency: string; status: string; created_at: string; first_action_at: string | null;
  due_at: string | null; archived_at: string | null;
};
export type TodayRow = {
  id: string; kind: "fault" | "task" | "maintenance"; title: string; building: string | null;
  due: string | null; urgency?: string; flagHours?: number;
};
export type TodayData = {
  counts: { overdue: number; today: number; openFaults: number };
  overdue: TodayRow[]; soon: TodayRow[]; faults: TodayRow[];
};

const byDueThenId = (a: TodayRow, b: TodayRow) => (a.due ?? "").localeCompare(b.due ?? "") || a.id.localeCompare(b.id);
const urgencyRank = (u: string) => URGENCIES.indexOf(u as (typeof URGENCIES)[number]);

export function buildToday(input: { items: MaintItemRow[]; tickets: TicketRow[]; now: Date }): TodayData {
  const today = todayIL(input.now);
  const horizon = addDays(today, SOON_DAYS);
  const overdue: TodayRow[] = [];
  const soon: TodayRow[] = [];
  const faults: TodayRow[] = [];
  let dueToday = 0;
  let openFaults = 0;

  for (const m of input.items) {
    if (m.archived_at || !m.applicable) continue;
    const row: TodayRow = { id: m.id, kind: "maintenance", title: m.system, building: m.building_name, due: m.next_due_at };
    const state = maintenanceState(m, today);
    if (state === "overdue") overdue.push(row);
    else if (state === "soon") {
      soon.push(row);
      if (m.next_due_at === today) dueToday++;
    }
  }

  for (const t of input.tickets) {
    if (t.archived_at || !isOpen(t.status)) continue;
    const row: TodayRow = { id: t.id, kind: t.kind, title: t.title, building: t.building_name, due: t.due_at, urgency: t.urgency };
    if (t.kind === "fault") openFaults++;
    if (t.due_at && daysBetween(today, t.due_at) < 0) {
      overdue.push(row);
    } else if (t.kind === "task") {
      if (t.due_at && t.due_at <= horizon) {
        soon.push(row);
        if (t.due_at === today) dueToday++;
      }
    } else {
      const flag = hoursWithoutAction(t, input.now);
      faults.push({ ...row, ...(flag !== null ? { flagHours: flag } : {}), due: t.created_at });
    }
  }

  overdue.sort(byDueThenId);
  soon.sort(byDueThenId);
  faults.sort((a, b) => urgencyRank(b.urgency ?? "") - urgencyRank(a.urgency ?? "") || (a.due ?? "").localeCompare(b.due ?? ""));
  return { counts: { overdue: overdue.length, today: dueToday, openFaults }, overdue, soon, faults };
}
