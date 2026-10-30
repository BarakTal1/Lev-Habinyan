import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLedger, tariffCharges, type LedgerCharge, type LedgerPayment, type Method, type UnitLedger } from "@/lib/domain/ledger";
import type { Problem } from "@/lib/import/controlSheet";
import { parsePaymentsSheet, parseTariffSheet, type PaymentRow } from "@/lib/import/ledgerSheets";
import { normUnit } from "@/lib/import/sheet";

export type { Method };
export type ImportKind = "tariffs" | "payments";
export type ImportSource = "excel" | "bllink_import";
export type ImportPreview = { added: number; changed: number; unchanged: number; unmatched: { row: number; unit: string }[]; problems: Problem[] };
export type DebtorRow = UnitLedger & { buildingId: string; buildingName: string; unit: string; payerName: string | null; payerPhone: string | null };
export type LedgerTotals = { due: number; paid: number; debt: number; debtors: number; thisMonthDue: number; thisMonthPaid: number };
export type UnmatchedPayment = { id: string; buildingId: string; buildingName: string; amount: number; paidAt: string; rawUnit: string; method: Method };

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

// PostgREST returns at most 1000 rows per request (Supabase max_rows). Every list read pages through all rows.
const PAGE = 1000;
// Long id lists go in chunks, so the request URL stays short.
const CHUNK = 100;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const r = await page(from, from + PAGE - 1);
    if (r.error) throw new Error(r.error.message);
    const rows = r.data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Each first-of-month date from `from` to `to`, both included. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export async function setMonthlyFee(db: SupabaseClient, unitId: string, amount: number, fromMonth: string, toMonth: string): Promise<number> {
  const rows = monthsBetween(fromMonth, toMonth).map((month) => ({ unit_id: unitId, month, amount_agorot: amount }));
  if (rows.length === 0) return 0;
  must(await db.from("tariff").upsert(rows, { onConflict: "unit_id,month" }).select("unit_id"));
  return rows.length;
}

export async function addSpecialCharge(db: SupabaseClient, profileId: string, input: { buildingId: string; name: string; dueDate: string; lines: { unitId: string; amount: number }[] }): Promise<string> {
  const charge = must(await db.from("special_charge").insert({ building_id: input.buildingId, name: input.name, due_date: input.dueDate, created_by: profileId }).select("id").single());
  if (input.lines.length) must(await db.from("special_charge_line").insert(input.lines.map((l) => ({ special_charge_id: charge.id, unit_id: l.unitId, amount_agorot: l.amount }))).select("unit_id"));
  return charge.id;
}

export async function recordPayment(db: SupabaseClient, profileId: string, input: { buildingId: string; unitId: string; amount: number; paidAt: string; month: string | null; method: Method; note?: string }): Promise<string> {
  const row = must(await db.from("payment").insert({
    building_id: input.buildingId, unit_id: input.unitId, amount_agorot: input.amount, paid_at: input.paidAt, month: input.month,
    method: input.method, source: "manual", note: input.note ?? null, created_by: profileId,
  }).select("id").single());
  return row.id;
}

export async function linkPayment(db: SupabaseClient, paymentId: string, unitId: string): Promise<void> {
  must(await db.from("payment").update({ unit_id: unitId }).eq("id", paymentId).select("id").single());
}

type UnitRow = { id: string; number: string; payer: string | null; primary_contact_id: string | null; building_id: string; building: { name: string; archived_at: string | null } | null; people: { relation: string; approved_at: string | null; person: { id: string; name: string; phone: string | null; archived_at: string | null } | null }[] };

export async function loadLedger(db: SupabaseClient, opts: { buildingId?: string; today: string }): Promise<{ rows: DebtorRow[]; totals: LedgerTotals }> {
  const b = opts.buildingId;
  const units = (await fetchAll<UnitRow>((from, to) => {
    let q = db.from("unit")
      .select("id, number, payer, primary_contact_id, building_id, building:building_id(name, archived_at), people:unit_person(relation, approved_at, person:person_id(id, name, phone, archived_at))")
      .is("archived_at", null).order("id").range(from, to);
    if (b) q = q.eq("building_id", b);
    return q as unknown as Page<UnitRow>;
  })).filter((u) => u.building && !u.building.archived_at);
  const live = new Set(units.map((u) => u.id));
  if (live.size === 0) return { rows: [], totals: { due: 0, paid: 0, debt: 0, debtors: 0, thisMonthDue: 0, thisMonthPaid: 0 } };

  // Filter by building in the database (not by a list of unit ids), then keep live units only.
  type Line = { unit_id: string; amount_agorot: number; charge: { name: string; due_date: string; archived_at: string | null } | null };
  const [tariffs, lines, payments] = await Promise.all([
    fetchAll<{ unit_id: string; month: string; amount_agorot: number }>((from, to) => {
      let q = db.from("tariff").select("unit_id, month, amount_agorot, unit:unit_id!inner(building_id)").order("unit_id").order("month").range(from, to);
      if (b) q = q.eq("unit.building_id", b);
      return q as unknown as Page<{ unit_id: string; month: string; amount_agorot: number }>;
    }),
    fetchAll<Line>((from, to) => {
      let q = db.from("special_charge_line").select("unit_id, amount_agorot, charge:special_charge_id!inner(name, due_date, archived_at, building_id)").order("special_charge_id").order("unit_id").range(from, to);
      if (b) q = q.eq("charge.building_id", b);
      return q as unknown as Page<Line>;
    }),
    fetchAll<{ unit_id: string; amount_agorot: number; paid_at: string; month: string | null }>((from, to) => {
      let q = db.from("payment").select("unit_id, amount_agorot, paid_at, month").not("unit_id", "is", null).is("archived_at", null).order("id").range(from, to);
      if (b) q = q.eq("building_id", b);
      return q as unknown as Page<{ unit_id: string; amount_agorot: number; paid_at: string; month: string | null }>;
    }),
  ]);
  const charges: LedgerCharge[] = [
    ...tariffCharges(tariffs.filter((t) => live.has(t.unit_id))),
    ...lines
      .filter((l) => live.has(l.unit_id) && l.charge && !l.charge.archived_at)
      .map((l) => ({ unitId: l.unit_id, due: l.charge!.due_date, amount: l.amount_agorot, label: l.charge!.name })),
  ];
  const pays: LedgerPayment[] = payments.filter((p) => live.has(p.unit_id)).map((p) => ({ unitId: p.unit_id, amount: p.amount_agorot, paidAt: p.paid_at, month: p.month }));
  const ledger = buildLedger(charges, pays, opts.today);

  const rows: DebtorRow[] = units.map((u) => {
    // A fixed order, so the same apartment always shows the same payer.
    const people = u.people.filter((p) => p.person && !p.person.archived_at && p.approved_at !== null).sort((x, y) => x.person!.id.localeCompare(y.person!.id));
    // The payer is a person in the paying role; the apartment's primary contact wins when several share that role.
    const inRole = (rel: string) => people.filter((p) => p.relation === rel);
    const pick = (list: typeof people) => list.find((p) => p.person!.id === u.primary_contact_id) ?? list[0] ?? null;
    const payer = pick(inRole(u.payer ?? "owner")) ?? pick(inRole("owner"));
    const l = ledger.get(u.id) ?? { unitId: u.id, due: 0, paid: 0, balance: 0, monthsOwed: 0, oldestOpen: null, lastPaidAt: null };
    return { ...l, buildingId: u.building_id, buildingName: u.building!.name, unit: u.number, payerName: payer?.person?.name ?? null, payerPhone: payer?.person?.phone ?? null };
  });
  const monthStart = opts.today.slice(0, 8) + "01";
  const inMonth = (d: string) => d >= monthStart && d <= opts.today;
  const totals: LedgerTotals = {
    due: rows.reduce((s, r) => s + r.due, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    debt: rows.reduce((s, r) => s + Math.max(r.balance, 0), 0),
    debtors: rows.filter((r) => r.balance > 0).length,
    thisMonthDue: charges.filter((c) => inMonth(c.due)).reduce((s, c) => s + c.amount, 0),
    thisMonthPaid: pays.filter((p) => inMonth(p.paidAt)).reduce((s, p) => s + p.amount, 0),
  };
  rows.sort((a, b) => a.buildingName.localeCompare(b.buildingName, "he") || a.unit.localeCompare(b.unit, "he", { numeric: true }));
  return { rows, totals };
}

export async function loadUnmatched(db: SupabaseClient, buildingId?: string): Promise<UnmatchedPayment[]> {
  type Row = { id: string; building_id: string; amount_agorot: number; paid_at: string; method: Method; raw: { unit?: string } | null; building: { name: string } | null };
  return (await fetchAll<Row>((from, to) => {
    let q = db.from("payment").select("id, building_id, amount_agorot, paid_at, method, raw, building:building_id(name)").is("unit_id", null).is("archived_at", null).order("paid_at").order("id").range(from, to);
    if (buildingId) q = q.eq("building_id", buildingId);
    return q as unknown as Page<Row>;
  }))
    .map((p) => ({ id: p.id, buildingId: p.building_id, buildingName: p.building?.name ?? "", amount: p.amount_agorot, paidAt: p.paid_at, rawUnit: p.raw?.unit ?? "", method: p.method }));
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A stable id for an imported payment. Identical rows get an occurrence number, so two real equal payments both count and a second import of the same file adds nothing. */
async function externalIds(buildingId: string, rows: PaymentRow[]): Promise<string[]> {
  const seen = new Map<string, number>();
  return Promise.all(rows.map((r) => {
    const key = [buildingId, r.unit, r.paidAt, r.amount, r.reference ?? ""].join("|");
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return sha256(`${key}#${n}`);
  }));
}

type Plan = { preview: ImportPreview; write: () => Promise<void> };

async function planImport(db: SupabaseClient, kind: ImportKind, buildingId: string, grid: string[][], source: ImportSource, batch?: () => Promise<string>): Promise<Plan> {
  const units = await fetchAll<{ id: string; number: string }>((from, to) => db.from("unit").select("id, number").eq("building_id", buildingId).is("archived_at", null).order("id").range(from, to));
  const unitId = new Map(units.map((u) => [normUnit(u.number), u.id as string]));

  if (kind === "tariffs") {
    const { rows, problems } = parseTariffSheet(grid);
    const known = rows.filter((r) => unitId.has(r.unit));
    const unmatched = rows.filter((r) => !unitId.has(r.unit)).map((r) => ({ row: r.row, unit: r.unit }));
    const existing = await fetchAll<{ unit_id: string; month: string; amount_agorot: number }>((from, to) =>
      db.from("tariff").select("unit_id, month, amount_agorot, unit:unit_id!inner(building_id)").eq("unit.building_id", buildingId).order("unit_id").order("month").range(from, to) as unknown as Page<{ unit_id: string; month: string; amount_agorot: number }>);
    const cur = new Map(existing.map((t) => [`${t.unit_id}|${t.month}`, t.amount_agorot]));
    let added = 0, changed = 0, unchanged = 0;
    for (const r of known) {
      const old = cur.get(`${unitId.get(r.unit)}|${r.month}`);
      if (old === undefined) added++; else if (old !== r.amount) changed++; else unchanged++;
    }
    const uniqueUnmatched = unmatched.filter((u, i) => unmatched.findIndex((x) => x.unit === u.unit) === i);
    return {
      preview: { added, changed, unchanged, unmatched: uniqueUnmatched, problems },
      write: async () => {
        if (known.length) must(await db.from("tariff").upsert(known.map((r) => ({ unit_id: unitId.get(r.unit)!, month: r.month, amount_agorot: r.amount })), { onConflict: "unit_id,month" }).select("unit_id"));
      },
    };
  }

  const parsed = parsePaymentsSheet(grid);
  const rows = parsed.rows;
  const extIds = await externalIds(buildingId, rows);
  // A file counts as already imported under either import source, so one file under both tabs adds nothing twice.
  const have = new Set<string>();
  for (let i = 0; i < extIds.length; i += CHUNK) {
    const r = must(await db.from("payment").select("external_id").in("source", ["excel", "bllink_import"]).in("external_id", extIds.slice(i, i + CHUNK)));
    for (const p of r) have.add(p.external_id as string);
  }
  const fresh = rows.map((r, i) => ({ r, ext: extIds[i] })).filter((x) => !have.has(x.ext));
  const unmatched = rows.filter((r) => !unitId.has(r.unit)).map((r) => ({ row: r.row, unit: r.unit }));
  return {
    preview: { added: fresh.length, changed: 0, unchanged: rows.length - fresh.length, unmatched, problems: parsed.problems },
    write: async () => {
      if (!fresh.length) return;
      const batchId = batch ? await batch() : null;
      must(await db.from("payment").upsert(fresh.map(({ r, ext }) => ({
        building_id: buildingId, unit_id: unitId.get(r.unit) ?? null, month: r.month, amount_agorot: r.amount, paid_at: r.paidAt,
        method: r.method, source, external_id: ext, raw: { unit: r.unit, reference: r.reference }, import_batch_id: batchId,
      })), { onConflict: "source,external_id", ignoreDuplicates: true }).select("id"));
    },
  };
}

export async function previewImport(db: SupabaseClient, kind: ImportKind, buildingId: string, grid: string[][], source: ImportSource): Promise<ImportPreview> {
  return (await planImport(db, kind, buildingId, grid, source)).preview;
}

export async function applyImport(db: SupabaseClient, profileId: string, kind: ImportKind, buildingId: string, fileName: string, grid: string[][], source: ImportSource): Promise<ImportPreview & { batchId: string }> {
  let batchId = "";
  const makeBatch = async () => {
    if (!batchId) batchId = must(await db.from("import_batch").insert({ kind, file_name: fileName, uploaded_by: profileId }).select("id").single()).id;
    return batchId;
  };
  const plan = await planImport(db, kind, buildingId, grid, source, makeBatch);
  await makeBatch();
  await plan.write();
  must(await db.from("import_batch").update({ summary: { ...plan.preview, source } }).eq("id", batchId).select("id").single());
  return { ...plan.preview, batchId };
}
