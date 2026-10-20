import type { SupabaseClient } from "@supabase/supabase-js";
import { SOON_DAYS } from "@/lib/domain/maintenance";
import { getSetting } from "@/lib/db/people";
import { addDays, daysBetween, formatDate, todayIL } from "@/lib/israel";

export type ReminderItem = {
  id: string; building_name: string | null; system: string; applicable: boolean; next_due_at: string | null; archived_at: string | null;
};
export type Reminder = { itemId: string; kind: "before14" | "due"; due: string; building: string | null; system: string };
export type Mail = { to: string[]; subject: string; text: string };

export const reminderKey = (itemId: string, kind: string, due: string) => `${itemId}:${kind}:${due}`;

/** Reminders to send today: 14 days before the due date and on the due date. Items already sent are skipped. */
export function remindersDue(items: ReminderItem[], today: string, alreadySent: Set<string>): Reminder[] {
  const out: Reminder[] = [];
  for (const i of items) {
    if (i.archived_at || !i.applicable || !i.next_due_at) continue;
    const d = daysBetween(today, i.next_due_at);
    const kind = d === SOON_DAYS ? "before14" : d === 0 ? "due" : null;
    if (!kind || alreadySent.has(reminderKey(i.id, kind, i.next_due_at))) continue;
    out.push({ itemId: i.id, kind, due: i.next_due_at, building: i.building_name, system: i.system });
  }
  return out;
}

export function digest(reminders: Reminder[], today: string): Mail["text"] & string {
  const line = (r: Reminder) => `• ${r.building ?? "כללי"} · ${r.system} · ${formatDate(r.due)}`;
  const due = reminders.filter((r) => r.kind === "due").map(line);
  const soon = reminders.filter((r) => r.kind === "before14").map(line);
  return [
    `תזכורות תחזוקה ל-${formatDate(today)}`,
    due.length ? `\nמועד היעד היום:\n${due.join("\n")}` : "",
    soon.length ? `\nבעוד ${SOON_DAYS} ימים:\n${soon.join("\n")}` : "",
  ].join("\n").trim();
}

/** Daily job. Sends one digest to the founders when the setting is on, then records what was sent. A failed send records nothing. */
export async function runReminders(db: SupabaseClient, send: (m: Mail) => Promise<void>, now: Date = new Date()): Promise<{ sent: number }> {
  if (!(await getSetting(db, "email_reminders", false))) return { sent: 0 };
  const today = todayIL(now);
  const horizon = addDays(today, SOON_DAYS);
  const [items, log, profiles] = await Promise.all([
    db.from("maintenance_item").select("id, system, applicable, next_due_at, archived_at, building:building_id(name, archived_at)").is("archived_at", null).in("next_due_at", [today, horizon]),
    db.from("reminder_log").select("item_id, kind, due_date"),
    db.from("profile").select("email"),
  ]);
  for (const r of [items, log, profiles]) if (r.error) throw new Error(r.error.message);
  const rows: ReminderItem[] = (items.data ?? [])
    .map((r) => ({ ...r, building: r.building as unknown as { name: string; archived_at: string | null } | null }))
    .filter((r) => !r.building?.archived_at)
    .map((r) => ({ id: r.id, building_name: r.building?.name ?? null, system: r.system, applicable: r.applicable, next_due_at: r.next_due_at, archived_at: r.archived_at }));
  const sent = new Set((log.data ?? []).map((l) => reminderKey(l.item_id, l.kind, l.due_date)));
  const due = remindersDue(rows, today, sent);
  if (due.length === 0) return { sent: 0 };
  await send({ to: (profiles.data ?? []).map((p) => p.email), subject: `תזכורות תחזוקה – ${formatDate(today)}`, text: digest(due, today) });
  const ins = await db.from("reminder_log").insert(due.map((r) => ({ item_id: r.itemId, kind: r.kind, due_date: r.due })));
  if (ins.error) throw new Error(ins.error.message);
  return { sent: due.length };
}
