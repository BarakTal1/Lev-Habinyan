import type { SupabaseClient } from "@supabase/supabase-js";
import { completeMaintenanceItem } from "@/lib/db/complete";
import { createTicket } from "@/lib/db/tickets";
import { addFrequency, maintenanceState, type FreqUnit, type MaintState } from "@/lib/domain/maintenance";
import { todayIL } from "@/lib/israel";
import { SYSTEMS, SYSTEM_CATEGORY, type System } from "@/lib/labels";

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

/** Creates the 12 maintenance items for a building when they are missing. Safe to call again. */
export async function ensureItems(db: SupabaseClient, buildingId: string): Promise<void> {
  const rows = SYSTEMS.map((system) => ({ building_id: buildingId, system, applicable: true }));
  const r = await db.from("maintenance_item").upsert(rows, { onConflict: "building_id,system", ignoreDuplicates: true });
  if (r.error) throw new Error(r.error.message);
}

export type ItemPatch = {
  applicable?: boolean; frequency_unit?: FreqUnit | null; frequency_count?: number | null; frequency_note?: string | null;
  last_done_at?: string | null; next_due_at?: string | null; supplier_id?: string | null; notes?: string | null;
};

/** Updates an item. When a frequency is set and no next date is given, the next date is computed from the last done date (if there is one). */
export async function updateItem(db: SupabaseClient, itemId: string, patch: ItemPatch): Promise<void> {
  const next = { ...patch };
  if (next.frequency_unit && next.frequency_count && !next.next_due_at) {
    const last = next.last_done_at ?? must(await db.from("maintenance_item").select("last_done_at").eq("id", itemId).single()).last_done_at;
    if (last) next.next_due_at = addFrequency(last, next.frequency_unit, next.frequency_count);
  }
  must(await db.from("maintenance_item").update(next).eq("id", itemId).select("id").single());
}

/** Marks an item done. `needsFrequency` is true when there is no next date, so the screen can ask for a frequency. */
export async function markDone(
  db: SupabaseClient, profileId: string, itemId: string, input: { done_at: string; note?: string; file?: File },
): Promise<{ next_due_at: string | null; needsFrequency: boolean }> {
  const r = await completeMaintenanceItem(db, profileId, itemId, input.done_at, input.note);
  if (input.file && input.file.size > 0) {
    const item = must(await db.from("maintenance_item").select("building_id").eq("id", itemId).single());
    const ext = (input.file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const path = `buildings/${item.building_id}/${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from("attachments").upload(path, input.file, { contentType: input.file.type || undefined });
    if (up.error) throw new Error(up.error.message);
    const att = must(await db.from("attachment").insert({ building_id: item.building_id, kind: input.file.type.startsWith("image/") ? "photo" : "document", storage_path: path, mime_type: input.file.type || null, created_by: profileId }).select("id").single());
    await db.from("maintenance_log").update({ attachment_id: att.id }).eq("item_id", itemId).eq("done_at", input.done_at);
  }
  return { next_due_at: r.next_due_at, needsFrequency: r.next_due_at === null };
}

/** Creates a task for an item. If an open task already exists for the item, returns it instead. */
export async function createTaskFromItem(db: SupabaseClient, profileId: string, itemId: string): Promise<{ ticketId: string }> {
  const open = await db.from("ticket").select("id").eq("maintenance_item_id", itemId).is("archived_at", null).not("status", "in", "(בוצע,בוטל)").limit(1).maybeSingle();
  if (open.data) return { ticketId: open.data.id };
  const item = must(await db.from("maintenance_item").select("building_id, system, next_due_at").eq("id", itemId).single());
  const t = await createTicket(db, profileId, {
    kind: "task", title: item.system, category: SYSTEM_CATEGORY[item.system as System] ?? "אחר",
    building_id: item.building_id, due_at: item.next_due_at, maintenance_item_id: itemId,
  });
  return { ticketId: t.id };
}

export type MaintRow = {
  id: string; system: System; applicable: boolean; state: MaintState; last_done_at: string | null; next_due_at: string | null;
  frequency_unit: FreqUnit | null; frequency_count: number | null; frequency_note: string | null; supplier_id: string | null; supplier_name: string | null; notes: string | null;
};

export async function loadBuildingMaintenance(db: SupabaseClient, buildingId: string, now: Date = new Date()): Promise<MaintRow[]> {
  const today = todayIL(now);
  const rows = must(await db.from("maintenance_item")
    .select("id, system, applicable, last_done_at, next_due_at, frequency_unit, frequency_count, frequency_note, supplier_id, notes, supplier:supplier_id(name)")
    .eq("building_id", buildingId).is("archived_at", null));
  return rows
    .map((r) => ({
      id: r.id, system: r.system as System, applicable: r.applicable, state: maintenanceState(r, today),
      last_done_at: r.last_done_at, next_due_at: r.next_due_at, frequency_unit: r.frequency_unit as FreqUnit | null, frequency_count: r.frequency_count,
      frequency_note: r.frequency_note, supplier_id: r.supplier_id, supplier_name: (r.supplier as unknown as { name: string } | null)?.name ?? null, notes: r.notes,
    }))
    .sort((a, b) => SYSTEMS.indexOf(a.system) - SYSTEMS.indexOf(b.system));
}

export type PortfolioRow = { id: string; name: string; city: string | null; cells: { system: System; state: MaintState }[] };

/** Every building with one cell per system. A system with no item row counts as nodata. */
export async function loadPortfolio(db: SupabaseClient, now: Date = new Date()): Promise<PortfolioRow[]> {
  const today = todayIL(now);
  const [b, m] = await Promise.all([
    db.from("building").select("id, name, city").is("archived_at", null).order("name"),
    db.from("maintenance_item").select("building_id, system, applicable, last_done_at, next_due_at").is("archived_at", null),
  ]);
  const byKey = new Map<string, MaintState>();
  for (const r of must(m)) byKey.set(`${r.building_id}|${r.system}`, maintenanceState(r, today));
  return must(b).map((x) => ({ id: x.id, name: x.name, city: x.city, cells: SYSTEMS.map((system) => ({ system, state: byKey.get(`${x.id}|${system}`) ?? "nodata" })) }));
}
