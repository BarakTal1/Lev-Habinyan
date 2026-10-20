import type { SupabaseClient } from "@supabase/supabase-js";
import { completeItem, type FreqUnit } from "@/lib/domain/maintenance";
import { todayIL } from "@/lib/israel";

/** Marks a maintenance item done: new last/next dates and one log row. A second call on the same day does nothing. */
export async function completeMaintenanceItem(db: SupabaseClient, profileId: string, itemId: string, doneAt: string, note?: string): Promise<{ next_due_at: string | null }> {
  const { data: item, error } = await db.from("maintenance_item").select("frequency_unit, frequency_count, next_due_at").eq("id", itemId).single();
  if (error) throw error;
  const { count } = await db.from("maintenance_log").select("*", { count: "exact", head: true }).eq("item_id", itemId).eq("done_at", doneAt);
  if (count && count > 0) return { next_due_at: item.next_due_at };
  const next = completeItem({ frequency_unit: item.frequency_unit as FreqUnit | null, frequency_count: item.frequency_count }, doneAt);
  const upd = await db.from("maintenance_item").update(next).eq("id", itemId);
  if (upd.error) throw upd.error;
  const log = await db.from("maintenance_log").insert({ item_id: itemId, done_at: doneAt, note: note ?? null, done_by: profileId });
  if (log.error) throw log.error;
  return { next_due_at: next.next_due_at };
}

/**
 * The Today check-off. A task closes (and completes its linked item). A maintenance row completes the item.
 * `needsFrequency` is true when the item has no next date afterwards, so the screen can ask for a frequency.
 * Safe to repeat: a retry after a partial failure still completes the linked item.
 */
export async function completeRow(db: SupabaseClient, profileId: string, kind: "task" | "maintenance", id: string, now: Date = new Date()): Promise<{ needsFrequency: boolean }> {
  const today = todayIL(now);
  if (kind === "maintenance") {
    const r = await completeMaintenanceItem(db, profileId, id, today);
    return { needsFrequency: r.next_due_at === null };
  }
  const { data: t, error } = await db.from("ticket").select("status, maintenance_item_id").eq("id", id).single();
  if (error) throw error;
  if (t.status !== "בוצע") {
    const upd = await db.from("ticket").update({ status: "בוצע", closed_at: now.toISOString() }).eq("id", id);
    if (upd.error) throw upd.error;
    const ev = await db.from("ticket_event").insert({ ticket_id: id, type: "status", actor: profileId, payload: { from: t.status, to: "בוצע" } });
    if (ev.error) throw ev.error;
  }
  if (!t.maintenance_item_id) return { needsFrequency: false };
  const r = await completeMaintenanceItem(db, profileId, t.maintenance_item_id, today);
  return { needsFrequency: r.next_due_at === null };
}
