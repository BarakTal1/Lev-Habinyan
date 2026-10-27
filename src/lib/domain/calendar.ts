import { addDays, isoToIsraelLocal } from "@/lib/israel";

export type CalKind = "visit" | "due" | "maintenance" | "opened";

export type CalEvent = {
  /** Stable id, also used for the calendar UID. */
  id: string;
  kind: CalKind;
  /** YYYY-MM-DD in Israel. */
  date: string;
  /** HH:mm in Israel. Only a visit has a time. */
  time: string | null;
  title: string;
  building: string | null;
  urgency?: string;
  /** Done or cancelled ticket. */
  done: boolean;
  href: string | null;
};

export type CalTicket = {
  id: string; number: number; kind: "fault" | "task"; title: string; urgency: string; status: string;
  created_at: string; due_at: string | null; scheduled_at: string | null; building_name: string | null;
};
export type CalItem = { id: string; building_id: string; system: string; applicable: boolean; next_due_at: string | null; building_name: string | null };

const CLOSED = ["בוצע", "בוטל"];

/** Every date that matters becomes one event: a visit, a due date, a maintenance date, and the day a fault opened. */
export function buildEvents(tickets: CalTicket[], items: CalItem[]): CalEvent[] {
  const out: CalEvent[] = [];
  for (const t of tickets) {
    const base = { title: t.title, building: t.building_name, urgency: t.urgency, done: CLOSED.includes(t.status), href: `/tickets/${t.id}` };
    if (t.scheduled_at) {
      const [date, time] = isoToIsraelLocal(t.scheduled_at).split("T");
      out.push({ ...base, id: `visit-${t.id}`, kind: "visit", date, time });
    }
    if (t.due_at) out.push({ ...base, id: `due-${t.id}`, kind: "due", date: t.due_at.slice(0, 10), time: null });
    if (t.kind === "fault") out.push({ ...base, id: `opened-${t.id}`, kind: "opened", date: isoToIsraelLocal(t.created_at).slice(0, 10), time: null });
  }
  for (const m of items) {
    if (!m.applicable || !m.next_due_at) continue;
    out.push({ id: `maint-${m.id}`, kind: "maintenance", date: m.next_due_at.slice(0, 10), time: null, title: m.system, building: m.building_name, done: false, href: `/maintenance/${m.building_id}` });
  }
  return out;
}

const ORDER: Record<CalKind, number> = { visit: 0, due: 1, maintenance: 2, opened: 3 };

/** Groups events by date. Inside a day, timed events come first, then by kind. */
export function eventsByDay(events: CalEvent[]): Record<string, CalEvent[]> {
  const days: Record<string, CalEvent[]> = {};
  for (const e of events) (days[e.date] ??= []).push(e);
  for (const list of Object.values(days)) {
    list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || ORDER[a.kind] - ORDER[b.kind] || a.title.localeCompare(b.title, "he"));
  }
  return days;
}

/** Weeks of a month, Sunday first. Each week has seven dates (YYYY-MM-DD), including the days of the next and the previous month. */
export function monthGrid(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  let day = addDays(first, -new Date(Date.UTC(y, m - 1, 1)).getUTCDay());
  const weeks: string[][] = [];
  while (day <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
    day = addDays(day, 7);
  }
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export const isMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}
