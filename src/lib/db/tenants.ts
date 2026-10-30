import type { SupabaseClient } from "@supabase/supabase-js";
import { setMonthlyFee } from "@/lib/db/ledger";
import type { Problem } from "@/lib/import/controlSheet";
import { parseApartmentsSheet, type ApartmentRow, type Contact } from "@/lib/import/apartmentsSheet";
import { normUnit } from "@/lib/import/sheet";
import { todayIL } from "@/lib/israel";

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

/** One form for comparing phones: digits only, with 972 written as a leading 0. */
const normPhone = (p: string | null) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.startsWith("972") ? "0" + d.slice(3) : d;
};
const normName = (n: string) => n.trim().replace(/\s+/g, " ");

type Match = { person: StoredPerson } | { conflict: StoredPerson } | null;

/**
 * The stored person in this role that the file row means. Same phone and same name, or same name.
 * Same phone with a different name is a conflict: families share phones, so the row must not rename someone else.
 */
function matchPerson(people: StoredPerson[], relation: string, c: Contact): Match {
  const inRole = people.filter((p) => p.relation === relation);
  const byPhone = c.phone ? inRole.find((p) => normPhone(p.phone) === normPhone(c.phone)) : undefined;
  if (byPhone) return normName(byPhone.name) === normName(c.name) ? { person: byPhone } : { conflict: byPhone };
  const byName = inRole.find((p) => normName(p.name) === normName(c.name));
  return byName ? { person: byName } : null;
}

/** Fields the file changes. An empty cell in the file never clears a stored value. */
function personPatch(p: StoredPerson, c: Contact): Partial<Contact> {
  const out: Partial<Contact> = {};
  if (normName(c.name) !== normName(p.name)) out.name = c.name;
  if (c.phone && normPhone(c.phone) !== normPhone(p.phone)) out.phone = c.phone;
  if (c.email && c.email !== p.email) out.email = c.email;
  return out;
}

const ROLE_WORD = { owner: "בעלים", tenant: "שוכר" } as const;
const MISSING = { owner: (n: string) => `הבעלים הרשומים (${n}) לא בקובץ`, tenant: (n: string) => `השוכרים הרשומים (${n}) לא בקובץ` } as const;

/** The months the fee in the file covers: this month to December. */
const feeMonths = (today: string): [string, string] => [today.slice(0, 8) + "01", `${today.slice(0, 4)}-12-01`];

/** True when the file's fee differs from a stored month in the range, or a month has no fee yet. */
function feeChanges(stored: Map<string, number>, from: string, to: string, fee: number): boolean {
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    if (stored.get(`${y}-${String(m).padStart(2, "0")}-01`) !== fee) return true;
    if (++m > 12) { m = 1; y++; }
  }
  return false;
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

/** Stored fees of the building's apartments for the months the file covers, by unit id then month. */
async function loadFees(db: SupabaseClient, buildingId: string, from: string, to: string): Promise<Map<string, Map<string, number>>> {
  const rows = must(await db.from("tariff").select("unit_id, month, amount_agorot, unit:unit_id!inner(building_id)").eq("unit.building_id", buildingId).gte("month", from).lte("month", to));
  const out = new Map<string, Map<string, number>>();
  for (const t of rows) (out.get(t.unit_id) ?? out.set(t.unit_id, new Map()).get(t.unit_id)!).set(t.month, t.amount_agorot);
  return out;
}

type Step = { row: ApartmentRow; unit: StoredUnit | undefined; feeChanged: boolean; people: { rel: "owner" | "tenant"; c: Contact; match: Match }[] };

/** What the file would do, row by row, and the counts and problems for the preview. */
async function planApartments(db: SupabaseClient, buildingId: string, grid: string[][], today: string) {
  const { rows, problems } = parseApartmentsSheet(grid);
  const units = await loadUnits(db, buildingId);
  const [from, to] = feeMonths(today);
  const fees = await loadFees(db, buildingId, from, to);
  const p: ApartmentsPreview = { unitsAdded: 0, unitsChanged: 0, peopleAdded: 0, peopleChanged: 0, fees: 0, problems: [...problems] };
  const steps: Step[] = rows.map((r) => {
    const u = units.get(r.unit);
    if (!u) p.unitsAdded++;
    else if (Object.keys(unitPatch(u, r)).length) p.unitsChanged++;
    const people = contacts(r).map(([rel, c]) => {
      const match = u ? matchPerson(u.people, rel, c) : null;
      if (!match) p.peopleAdded++;
      else if ("conflict" in match) p.problems.push({ row: r.row, column: ROLE_WORD[rel], reason: `אותו טלפון כמו ${match.conflict.name}, שם אחר. לא עודכן` });
      else if (Object.keys(personPatch(match.person, c)).length) p.peopleChanged++;
      // A stored person in this role who is not in the file may have left (for example a sold apartment). Report it; never remove.
      if (u && !match) {
        const stored = u.people.filter((x) => x.relation === rel).map((x) => x.name);
        if (stored.length) p.problems.push({ row: r.row, column: ROLE_WORD[rel], reason: MISSING[rel](stored.join(", ")) });
      }
      return { rel, c, match };
    });
    const feeChanged = r.fee !== null && feeChanges(u ? fees.get(u.id) ?? new Map() : new Map(), from, to, r.fee);
    if (feeChanged) p.fees++;
    return { row: r, unit: u, feeChanged, people };
  });
  return { preview: p, steps };
}

export async function previewApartments(db: SupabaseClient, buildingId: string, grid: string[][], today: string = todayIL(new Date())): Promise<ApartmentsPreview> {
  return (await planApartments(db, buildingId, grid, today)).preview;
}

/** Writes the apartments file: creates missing apartments and people, updates changed details, and sets the fee from this month to December. */
/** Writes the apartments file: creates missing apartments and people, updates changed details, and sets a changed fee from this month to December. Conflicts are skipped. */
export async function applyApartments(db: SupabaseClient, buildingId: string, grid: string[][], today: string): Promise<ApartmentsPreview> {
  const { preview, steps } = await planApartments(db, buildingId, grid, today);
  const [from, to] = feeMonths(today);
  const created = new Map<string, StoredUnit>();
  for (const s of steps) {
    const r = s.row;
    let u = s.unit ?? created.get(r.unit);
    if (!u) {
      const row = must(await db.from("unit").insert({ building_id: buildingId, number: r.unit, floor: r.floor, payer: r.payer }).select("id").single());
      u = { id: row.id, number: r.unit, floor: r.floor, payer: r.payer, people: [] };
      created.set(r.unit, u);
    } else {
      const patch = unitPatch(u, r);
      if (Object.keys(patch).length) must(await db.from("unit").update(patch).eq("id", u.id).select("id").single());
    }
    for (const { rel, c, match } of s.people) {
      if (match && "conflict" in match) continue;
      if (match) {
        const patch = personPatch(match.person, c);
        if (Object.keys(patch).length) must(await db.from("person").update(patch).eq("id", match.person.id).select("id").single());
        continue;
      }
      const person = must(await db.from("person").insert({ name: c.name, phone: c.phone, email: c.email, role: "resident" }).select("id").single());
      must(await db.from("unit_person").insert({ unit_id: u.id, person_id: person.id, relation: rel }).select("unit_id").single());
      u.people.push({ id: person.id, name: c.name, phone: c.phone, email: c.email, relation: rel });
    }
    if (s.feeChanged) await setMonthlyFee(db, u.id, r.fee!, from, to);
  }
  return preview;
}
