import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureItems } from "@/lib/db/maintenance";
import { nextDueFor, type ParsedRow } from "./controlSheet";

/** Writes parsed rows to the database. Creates missing buildings and items. An empty cell never clears existing data. */
export async function applyImport(db: SupabaseClient, rows: ParsedRow[]): Promise<{ buildings: number; created: number; items: number }> {
  const names = [...new Set(rows.map((r) => r.building))];
  const existing = await db.from("building").select("id, name").is("archived_at", null);
  if (existing.error) throw new Error(existing.error.message);
  const byName = new Map(existing.data.map((b) => [b.name.trim(), b.id as string]));
  let created = 0;
  for (const name of names) {
    if (byName.has(name)) continue;
    const ins = await db.from("building").insert({ name }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    byName.set(name, ins.data.id);
    created++;
  }
  let items = 0;
  for (const name of names) {
    const buildingId = byName.get(name)!;
    await ensureItems(db, buildingId);
    const cur = await db.from("maintenance_item").select("id, system").eq("building_id", buildingId);
    if (cur.error) throw new Error(cur.error.message);
    const idBySystem = new Map(cur.data.map((i) => [i.system, i.id as string]));
    for (const r of rows.filter((x) => x.building === name)) {
      const patch: Record<string, unknown> = { applicable: r.applicable };
      if (r.frequency_unit && r.frequency_count) { patch.frequency_unit = r.frequency_unit; patch.frequency_count = r.frequency_count; }
      if (r.last_done_at) patch.last_done_at = r.last_done_at;
      const next = nextDueFor(r);
      if (next) patch.next_due_at = next;
      const upd = await db.from("maintenance_item").update(patch).eq("id", idBySystem.get(r.system)!);
      if (upd.error) throw new Error(upd.error.message);
      items++;
    }
  }
  return { buildings: names.length, created, items };
}
