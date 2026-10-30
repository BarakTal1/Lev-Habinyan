import type { SupabaseClient } from "@supabase/supabase-js";
import { setMonthlyFee } from "@/lib/db/ledger";
import type { Problem } from "@/lib/import/controlSheet";
import { parseApartmentsSheet, type ApartmentRow, type Contact } from "@/lib/import/apartmentsSheet";
import { normUnit } from "@/lib/import/sheet";

export type ApartmentsPreview = { unitsAdded: number; unitsChanged: number; peopleAdded: number; peopleChanged: number; fees: number; problems: Problem[] };

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

export async function updateUnitDetails(db: SupabaseClient, unitId: string, patch: { floor?: string | null; payer?: "owner" | "tenant" | null; primaryContactId?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if ("floor" in patch) row.floor = patch.floor?.trim() || null;
  if ("payer" in patch) row.payer = patch.payer;
  if ("primaryContactId" in patch) row.primary_contact_id = patch.primaryContactId;
  must(await db.from("unit").update(row).eq("id", unitId).select("id").single());
}

export async function updatePerson(db: SupabaseClient, personId: string, patch: { name?: string; phone?: string | null; email?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if ("name" in patch) {
    row.name = String(patch.name ?? "").trim();
    if (!row.name) throw new Error("name required");
  }
  if ("phone" in patch) row.phone = patch.phone?.trim() || null;
  if ("email" in patch) row.email = patch.email?.trim() || null;
  must(await db.from("person").update(row).eq("id", personId).select("id").single());
}

type StoredPerson = { id: string; name: string; phone: string | null; email: string | null; relation: string };
type StoredUnit = { id: string; number: string; floor: string | null; payer: string | null; people: StoredPerson[] };

const digits = (p: string | null) => (p ?? "").replace(/\D/g, "");

/** The stored person in this role that the file row means: same phone first, else same name. */
function matchPerson(people: StoredPerson[], relation: string, c: Contact): StoredPerson | null {
  const inRole = people.filter((p) => p.relation === relation);
  return (c.phone ? inRole.find((p) => digits(p.phone) === digits(c.phone)) : undefined) ?? inRole.find((p) => p.name.trim() === c.name) ?? null;
}

/** Fields the file changes. An empty cell in the file never clears a stored value. */
function personPatch(p: StoredPerson, c: Contact): Partial<Contact> {
  const out: Partial<Contact> = {};
  if (c.name !== p.name) out.name = c.name;
  if (c.phone && c.phone !== p.phone) out.phone = c.phone;
  if (c.email && c.email !== p.email) out.email = c.email;
  return out;
}

function unitPatch(u: StoredUnit, r: ApartmentRow): { floor?: string; payer?: "owner" | "tenant" } {
  const out: { floor?: string; payer?: "owner" | "tenant" } = {};
  if (r.floor && r.floor !== u.floor) out.floor = r.floor;
  if (r.payer && r.payer !== u.payer) out.payer = r.payer;
  return out;
}

async function loadUnits(db: SupabaseClient, buildingId: string): Promise<Map<string, StoredUnit>> {
  const rows = must(await db.from("unit")
    .select("id, number, floor, payer, people:unit_person(relation, person:person_id(id, name, phone, email, archived_at))")
    .eq("building_id", buildingId).is("archived_at", null)) as unknown as { id: string; number: string; floor: string | null; payer: string | null; people: { relation: string; person: (Omit<StoredPerson, "relation"> & { archived_at: string | null }) | null }[] }[];
  return new Map(rows.map((u) => [normUnit(u.number), {
    id: u.id, number: u.number, floor: u.floor, payer: u.payer,
    people: u.people.filter((p) => p.person && !p.person.archived_at).map((p) => ({ id: p.person!.id, name: p.person!.name, phone: p.person!.phone, email: p.person!.email, relation: p.relation })),
  }]));
}

function contacts(r: ApartmentRow): [relation: "owner" | "tenant", c: Contact][] {
  return [["owner", r.owner], ["tenant", r.tenant]].filter((x): x is ["owner" | "tenant", Contact] => x[1] !== null);
}

export async function previewApartments(db: SupabaseClient, buildingId: string, grid: string[][]): Promise<ApartmentsPreview> {
  const { rows, problems } = parseApartmentsSheet(grid);
  const units = await loadUnits(db, buildingId);
  const p: ApartmentsPreview = { unitsAdded: 0, unitsChanged: 0, peopleAdded: 0, peopleChanged: 0, fees: 0, problems };
  for (const r of rows) {
    const u = units.get(r.unit);
    if (!u) p.unitsAdded++;
    else if (Object.keys(unitPatch(u, r)).length) p.unitsChanged++;
    for (const [rel, c] of contacts(r)) {
      const m = u ? matchPerson(u.people, rel, c) : null;
      if (!m) p.peopleAdded++;
      else if (Object.keys(personPatch(m, c)).length) p.peopleChanged++;
    }
    if (r.fee !== null) p.fees++;
  }
  return p;
}

/** Writes the apartments file: creates missing apartments and people, updates changed details, and sets the fee from this month to December. */
export async function applyApartments(db: SupabaseClient, buildingId: string, grid: string[][], today: string): Promise<ApartmentsPreview> {
  const preview = await previewApartments(db, buildingId, grid);
  const { rows } = parseApartmentsSheet(grid);
  const units = await loadUnits(db, buildingId);
  for (const r of rows) {
    let u = units.get(r.unit);
    if (!u) {
      const created = must(await db.from("unit").insert({ building_id: buildingId, number: r.unit, floor: r.floor, payer: r.payer }).select("id").single());
      u = { id: created.id, number: r.unit, floor: r.floor, payer: r.payer, people: [] };
      units.set(r.unit, u);
    } else {
      const patch = unitPatch(u, r);
      if (Object.keys(patch).length) must(await db.from("unit").update(patch).eq("id", u.id).select("id").single());
    }
    for (const [rel, c] of contacts(r)) {
      const m = matchPerson(u.people, rel, c);
      if (m) {
        const patch = personPatch(m, c);
        if (Object.keys(patch).length) must(await db.from("person").update(patch).eq("id", m.id).select("id").single());
        continue;
      }
      const person = must(await db.from("person").insert({ name: c.name, phone: c.phone, email: c.email, role: "resident" }).select("id").single());
      must(await db.from("unit_person").insert({ unit_id: u.id, person_id: person.id, relation: rel }).select("unit_id").single());
      u.people.push({ id: person.id, name: c.name, phone: c.phone, email: c.email, relation: rel });
    }
    if (r.fee !== null) await setMonthlyFee(db, u.id, r.fee, today.slice(0, 8) + "01", `${today.slice(0, 4)}-12-01`);
  }
  return preview;
}
