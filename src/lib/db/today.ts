import type { SupabaseClient } from "@supabase/supabase-js";
import { buildToday, type MaintItemRow, type TicketRow, type TodayData } from "@/lib/domain/today";

type Joined = { name: string; archived_at: string | null } | null;

export async function loadToday(db: SupabaseClient, now: Date = new Date()): Promise<TodayData> {
  const [items, tickets] = await Promise.all([
    db.from("maintenance_item")
      .select("id, system, applicable, last_done_at, next_due_at, archived_at, building:building_id(name, archived_at)")
      .is("archived_at", null),
    db.from("ticket")
      .select("id, kind, title, urgency, status, created_at, first_action_at, due_at, archived_at, building:building_id(name, archived_at)")
      .is("archived_at", null)
      .not("status", "in", "(בוצע,בוטל)"),
  ]);
  if (items.error) throw items.error;
  if (tickets.error) throw tickets.error;

  const itemRows: MaintItemRow[] = (items.data ?? [])
    .map((r) => ({ ...r, building: r.building as unknown as Joined }))
    .filter((r) => !r.building?.archived_at)
    .map(({ building, ...r }) => ({ ...r, building_name: building?.name ?? null }));
  const ticketRows: TicketRow[] = (tickets.data ?? [])
    .map((r) => ({ ...r, building: r.building as unknown as Joined }))
    .filter((r) => !r.building?.archived_at)
    .map(({ building, ...r }) => ({ ...r, kind: r.kind as "fault" | "task", building_name: building?.name ?? null }));

  return buildToday({ items: itemRows, tickets: ticketRows, now });
}
