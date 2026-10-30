import type { SupabaseClient } from "@supabase/supabase-js";
import { maintenanceState, type MaintState } from "@/lib/domain/maintenance";
import { todayIL } from "@/lib/israel";
import { SYSTEMS } from "@/lib/labels";
import { validateUpload } from "@/lib/uploads";

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

export type BuildingCard = {
  id: string; name: string; city: string | null; units: number; open_tickets: number;
  worst: MaintState; worst_count: number;
};

const RANK: Record<MaintState, number> = { overdue: 4, soon: 3, nodata: 2, ok: 1, na: 0 };

export async function listBuildingCards(db: SupabaseClient, now: Date = new Date()): Promise<BuildingCard[]> {
  const today = todayIL(now);
  const [b, u, t, m] = await Promise.all([
    db.from("building").select("id, name, city").is("archived_at", null).order("name"),
    db.from("unit").select("building_id").is("archived_at", null),
    db.from("ticket").select("building_id").is("archived_at", null).not("status", "in", "(בוצע,בוטל)").not("building_id", "is", null),
    db.from("maintenance_item").select("building_id, applicable, last_done_at, next_due_at").is("archived_at", null),
  ]);
  const units = new Map<string, number>();
  for (const r of must(u)) units.set(r.building_id, (units.get(r.building_id) ?? 0) + 1);
  const open = new Map<string, number>();
  for (const r of must(t)) open.set(r.building_id!, (open.get(r.building_id!) ?? 0) + 1);
  const worst = new Map<string, { state: MaintState; count: number }>();
  const withItems = new Set(must(m).map((r) => r.building_id));
  for (const r of must(m)) {
    const s = maintenanceState(r, today);
    if (s === "ok" || s === "na") continue;
    const cur = worst.get(r.building_id);
    if (!cur || RANK[s] > RANK[cur.state]) worst.set(r.building_id, { state: s, count: 1 });
    else if (cur.state === s) cur.count++;
  }
  return must(b).map((r) => ({
    id: r.id, name: r.name, city: r.city, units: units.get(r.id) ?? 0, open_tickets: open.get(r.id) ?? 0,
    // A building with no maintenance items has no data, the same as in the portfolio view.
    worst: withItems.has(r.id) ? (worst.get(r.id)?.state ?? "ok") : "nodata", worst_count: withItems.has(r.id) ? (worst.get(r.id)?.count ?? 0) : SYSTEMS.length,
  }));
}

export type Resident = { person_id: string; unit_id: string; unit: string; name: string; phone: string | null; email: string | null; relation: string; is_committee: boolean; approved: boolean };
export type Apartment = { id: string; number: string; floor: string | null; payer: "owner" | "tenant" | null; primary_contact_id: string | null };
export type BuildingDetail = {
  id: string; name: string; city: string | null; address: string | null; notes: string | null; units: number;
  residents: Resident[];
  apartments: Apartment[];
  suppliers: { id: string; name: string; phone: string | null; category: string }[];
  documents: { id: string; url: string | null; kind: string; created_at: string }[];
  open_tickets: number;
};

export async function getBuilding(db: SupabaseClient, id: string): Promise<BuildingDetail | null> {
  const b = await db.from("building").select("id, name, city, address, notes").eq("id", id).is("archived_at", null).maybeSingle();
  if (b.error) throw new Error(b.error.message);
  if (!b.data) return null;
  const units = await db.from("unit").select("id, number, floor, payer, primary_contact_id").eq("building_id", id).is("archived_at", null);
  const unitIds = must(units).map((u) => u.id);
  const [ups, items, docs, tickets] = await Promise.all([
    unitIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db.from("unit_person").select("unit_id, relation, approved_at, is_committee, person:person_id(id, name, phone, email, archived_at), unit:unit_id(number, building_id)").in("unit_id", unitIds),
    db.from("maintenance_item").select("supplier:supplier_id(id, name, phone, archived_at, supplier_profile(category))").eq("building_id", id).not("supplier_id", "is", null),
    db.from("attachment").select("id, kind, storage_path, created_at").eq("building_id", id).is("archived_at", null).order("created_at", { ascending: false }),
    db.from("ticket").select("id", { count: "exact", head: true }).eq("building_id", id).is("archived_at", null).not("status", "in", "(בוצע,בוטל)"),
  ]);
  type UP = { unit_id: string; relation: string; approved_at: string | null; is_committee: boolean; person: { id: string; name: string; phone: string | null; email: string | null; archived_at: string | null } | null; unit: { number: string; building_id: string } | null };
  const residents: Resident[] = (must(ups) as unknown as UP[])
    .filter((r) => r.unit?.building_id === id && r.person && !r.person.archived_at)
    .map((r) => ({ person_id: r.person!.id, unit_id: r.unit_id, unit: r.unit!.number, name: r.person!.name, phone: r.person!.phone, email: r.person!.email, relation: r.relation, is_committee: r.is_committee, approved: r.approved_at !== null }))
    .sort((a, c) => a.unit.localeCompare(c.unit, undefined, { numeric: true }));
  const seen = new Set<string>();
  const suppliers: BuildingDetail["suppliers"] = [];
  for (const r of must(items) as unknown as { supplier: { id: string; name: string; phone: string | null; archived_at: string | null; supplier_profile: { category: string } | { category: string }[] | null } | null }[]) {
    const s = r.supplier;
    if (!s || s.archived_at || seen.has(s.id)) continue;
    seen.add(s.id);
    const sp = Array.isArray(s.supplier_profile) ? s.supplier_profile[0] : s.supplier_profile;
    suppliers.push({ id: s.id, name: s.name, phone: s.phone, category: sp?.category ?? "" });
  }
  const documents = await Promise.all(must(docs).map(async (d) => ({
    id: d.id, kind: d.kind, created_at: d.created_at,
    url: (await db.storage.from("attachments").createSignedUrl(d.storage_path, 3600)).data?.signedUrl ?? null,
  })));
  return {
    ...b.data, units: must(units).length, residents,
    apartments: (must(units) as Apartment[]).sort((a, c) => a.number.localeCompare(c.number, undefined, { numeric: true })), suppliers, documents, open_tickets: tickets.count ?? 0,
  };
}

export async function createBuilding(db: SupabaseClient, input: { name: string; city?: string | null; address?: string | null }): Promise<string> {
  return must(await db.from("building").insert(input).select("id").single()).id;
}

export async function updateBuilding(db: SupabaseClient, id: string, patch: { name?: string; city?: string | null; address?: string | null; notes?: string | null }): Promise<void> {
  const clean = { ...patch };
  if ("name" in clean) {
    clean.name = String(clean.name ?? "").trim();
    if (!clean.name) throw new Error("name required");
  }
  must(await db.from("building").update(clean).eq("id", id).select("id").single());
}

/** Hides a building. Refused while it has an open ticket, so no open work disappears from the lists. */
export async function archiveBuilding(db: SupabaseClient, id: string): Promise<void> {
  const open = await db.from("ticket").select("id", { count: "exact", head: true }).eq("building_id", id).is("archived_at", null).not("status", "in", "(בוצע,בוטל)");
  if (open.error) throw new Error(open.error.message);
  if ((open.count ?? 0) > 0) throw new Error("building has open tickets");
  must(await db.from("building").update({ archived_at: new Date().toISOString() }).eq("id", id).select("id").single());
}

export async function addUnit(db: SupabaseClient, buildingId: string, number: string): Promise<string> {
  const found = await db.from("unit").select("id").eq("building_id", buildingId).eq("number", number).maybeSingle();
  if (found.data) return found.data.id;
  return must(await db.from("unit").insert({ building_id: buildingId, number }).select("id").single()).id;
}

export type AddResidentInput = { building_id: string; unit_number: string; name: string; phone: string; email?: string | null; relation: "owner" | "tenant"; is_committee?: boolean };

/** Adds a resident to a unit. Creates the unit when it does not exist. Returns the person id. */
export async function addResident(db: SupabaseClient, input: AddResidentInput): Promise<string> {
  const unitId = await addUnit(db, input.building_id, input.unit_number);
  const person = must(await db.from("person").insert({ name: input.name, phone: input.phone, email: input.email || null, role: input.is_committee ? "committee" : "resident" }).select("id").single());
  must(await db.from("unit_person").insert({ unit_id: unitId, person_id: person.id, relation: input.relation, is_committee: input.is_committee ?? false }).select("unit_id").single());
  return person.id;
}

export async function archiveResident(db: SupabaseClient, personId: string): Promise<void> {
  must(await db.from("person").update({ archived_at: new Date().toISOString() }).eq("id", personId).select("id").single());
}

export async function uploadBuildingDocument(db: SupabaseClient, profileId: string, buildingId: string, file: File): Promise<void> {
  validateUpload(file);
  const ext = (file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const path = `buildings/${buildingId}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);
  must(await db.from("attachment").insert({ building_id: buildingId, kind: "document", storage_path: path, mime_type: file.type || null, created_by: profileId }).select("id").single());
}
