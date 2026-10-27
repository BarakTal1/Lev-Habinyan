import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEvents, type CalEvent, type CalItem, type CalTicket } from "@/lib/domain/calendar";

type Joined = { name: string; archived_at: string | null } | null;

/** All dates the managers care about, for the signed-in user. The page picks the month. */
export async function loadCalendar(db: SupabaseClient): Promise<CalEvent[]> {
  const [tickets, items] = await Promise.all([
    db.from("ticket")
      .select("id, number, kind, title, urgency, status, created_at, due_at, scheduled_at, building:building_id(name, archived_at)")
      .is("archived_at", null),
    db.from("maintenance_item")
      .select("id, building_id, system, applicable, next_due_at, building:building_id(name, archived_at)")
      .is("archived_at", null)
      .not("next_due_at", "is", null),
  ]);
  if (tickets.error) throw tickets.error;
  if (items.error) throw items.error;
  const live = <T extends { building: unknown }>(r: T) => !(r.building as Joined)?.archived_at;
  const ticketRows: CalTicket[] = (tickets.data ?? []).filter(live).map(({ building, ...r }) => ({ ...r, kind: r.kind as "fault" | "task", building_name: (building as unknown as Joined)?.name ?? null }));
  const itemRows: CalItem[] = (items.data ?? []).filter(live).map(({ building, ...r }) => ({ ...r, building_name: (building as unknown as Joined)?.name ?? null }));
  return buildEvents(ticketRows, itemRows);
}

/** The dates for the secret feed link. Null when the token is unknown. */
export async function loadFeed(db: SupabaseClient, token: string): Promise<CalEvent[] | null> {
  const { data, error } = await db.rpc("calendar_feed", { p_token: token });
  if (error) throw error;
  if (!data) return null;
  return buildEvents((data.tickets ?? []) as CalTicket[], (data.items ?? []) as CalItem[]);
}

export async function getFeedToken(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.from("calendar_feed_token").select("token").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.token ?? null;
}
