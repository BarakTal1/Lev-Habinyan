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

type UnitRow = { id: string; number: string; payer: string | null; building_id: string; building: { name: string; archived_at: string | null } | null; people: { relation: string; person: { name: string; phone: string | null; archived_at: string | null } | null }[] };

export async function loadLedger(db: SupabaseClient, opts: { buildingId?: string; today: string }): Promise<{ rows: DebtorRow[]; totals: LedgerTotals }> {
  let uq = db.from("unit")
    .select("id, number, payer, building_id, building:building_id(name, archived_at), people:unit_person(relation, person:person_id(name, phone, archived_at))")
    .is("archived_at", null);
  if (opts.buildingId) uq = uq.eq("building_id", opts.buildingId);
  const units = (must(await uq) as unknown as UnitRow[]).filter((u) => u.building && !u.building.archived_at);
  const ids = units.map((u) => u.id);
  if (ids.length === 0) return { rows: [], totals: { due: 0, paid: 0, debt: 0, debtors: 0, thisMonthDue: 0, thisMonthPaid: 0 } };

  const [tariffs, lines, payments] = await Promise.all([
    db.from("tariff").select("unit_id, month, amount_agorot").in("unit_id", ids),
    db.from("special_charge_line").select("unit_id, amount_agorot, charge:special_charge_id(name, due_date, archived_at)").in("unit_id", ids),
    db.from("payment").select("unit_id, amount_agorot, paid_at, month").in("unit_id", ids).is("archived_at", null),
  ]);
  const charges: LedgerCharge[] = [
    ...tariffCharges(must(tariffs)),
    ...(must(lines) as unknown as { unit_id: string; amount_agorot: number; charge: { name: string; due_date: string; archived_at: string | null } | null }[])
      .filter((l) => l.charge && !l.charge.archived_at)
      .map((l) => ({ unitId: l.unit_id, due: l.charge!.due_date, amount: l.amount_agorot, label: l.charge!.name })),
  ];
  const pays: LedgerPayment[] = must(payments).map((p) => ({ unitId: p.unit_id as string, amount: p.amount_agorot, paidAt: p.paid_at, month: p.month }));
  const ledger = buildLedger(charges, pays, opts.today);

  const rows: DebtorRow[] = units.map((u) => {
    const people = u.people.filter((p) => p.person && !p.person.archived_at);
    const payer = people.find((p) => p.relation === (u.payer ?? "owner")) ?? people.find((p) => p.relation === "owner") ?? null;
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
  let q = db.from("payment").select("id, building_id, amount_agorot, paid_at, method, raw, building:building_id(name)").is("unit_id", null).is("archived_at", null).order("paid_at");
  if (buildingId) q = q.eq("building_id", buildingId);
  return (must(await q) as unknown as { id: string; building_id: string; amount_agorot: number; paid_at: string; method: Method; raw: { unit?: string } | null; building: { name: string } | null }[])
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
  const units = must(await db.from("unit").select("id, number").eq("building_id", buildingId).is("archived_at", null));
  const unitId = new Map(units.map((u) => [normUnit(u.number), u.id as string]));

  if (kind === "tariffs") {
    const { rows, problems } = parseTariffSheet(grid);
    const known = rows.filter((r) => unitId.has(r.unit));
    const unmatched = rows.filter((r) => !unitId.has(r.unit)).map((r) => ({ row: r.row, unit: r.unit }));
    const ids = [...new Set(known.map((r) => unitId.get(r.unit)!))];
    const existing = ids.length ? must(await db.from("tariff").select("unit_id, month, amount_agorot").in("unit_id", ids)) : [];
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
  const existing = extIds.length ? must(await db.from("payment").select("external_id").eq("source", source).in("external_id", extIds)) : [];
  const have = new Set(existing.map((p) => p.external_id));
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
