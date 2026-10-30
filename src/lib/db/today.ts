import type { SupabaseClient } from "@supabase/supabase-js";
import { buildToday, type MaintItemRow, type TicketRow, type TodayData } from "@/lib/domain/today";
import { buildTrend, type TrendWeek } from "@/lib/domain/dashboard";

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

/** Faults that were opened or closed in the last weeks, for the dashboard trend chart. */
export async function loadTrend(db: SupabaseClient, now: Date = new Date(), weeks = 8): Promise<TrendWeek[]> {
  const since = new Date(now.getTime() - (weeks * 7 + 1) * 86_400_000).toISOString();
  const { data, error } = await db.from("ticket")
    .select("created_at, closed_at")
    .eq("kind", "fault")
    .is("archived_at", null)
    .or(`created_at.gte.${since},closed_at.gte.${since}`);
  if (error) throw error;
  return buildTrend(data ?? [], now, weeks);
}
