// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { applyImport, linkPayment, loadLedger, loadUnmatched, previewImport, recordPayment, setMonthlyFee } from "@/lib/db/ledger";

const tag = `t-ledger-${Date.now()}`;
const today = "2026-10-30";
let db: SupabaseClient, admin: SupabaseClient, profileId: string;
let buildingId: string, u1: string, u2: string, u3: string, personId: string;

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
  const b = await admin.from("building").insert({ name: tag }).select("id").single();
  buildingId = b.data!.id;
  const units = await admin.from("unit").insert([
    { building_id: buildingId, number: "1" },
    { building_id: buildingId, number: "2", payer: "tenant" },
    { building_id: buildingId, number: "3" },
  ]).select("id, number");
  const id = (n: string) => units.data!.find((u) => u.number === n)!.id;
  [u1, u2, u3] = [id("1"), id("2"), id("3")];
  const p = await admin.from("person").insert({ name: `${tag} בעלים`, phone: "0520000001", role: "resident" }).select("id").single();
  personId = p.data!.id;
  await admin.from("unit_person").insert({ unit_id: u1, person_id: personId, relation: "owner" });
});

afterAll(async () => {
  await admin.from("payment").delete().eq("building_id", buildingId);
  await admin.from("import_batch").delete().like("file_name", `${tag}%`);
  await admin.from("tariff").delete().in("unit_id", [u1, u2, u3]);
  await admin.from("unit_person").delete().eq("person_id", personId);
  await admin.from("person").delete().eq("id", personId);
  await admin.from("unit").delete().eq("building_id", buildingId);
  await admin.from("building").delete().eq("id", buildingId);
});

const row = async (unitId: string) => (await loadLedger(db, { buildingId, today })).rows.find((r) => r.unitId === unitId);

describe("ledger database layer", () => {
  it("sets a monthly fee and shows the due amount with the payer", async () => {
    expect(await setMonthlyFee(db, u1, 35000, "2026-08-01", "2026-10-01")).toBe(3);
    const r = await row(u1);
    expect(r?.due).toBe(105000);
    expect(r?.unit).toBe("1");
    expect(r?.payerName).toBe(`${tag} בעלים`);
    expect(r?.buildingName).toBe(tag);
  });

  it("records a manual payment that lowers the balance", async () => {
    await recordPayment(db, profileId, { buildingId, unitId: u1, amount: 35000, paidAt: "2026-10-05", month: null, method: "cash" });
    const r = await row(u1);
    expect(r?.balance).toBe(70000);
    expect(r?.monthsOwed).toBe(2);
  });

  it("imports twice, writes once", async () => {
    const grid = [["דירה", "סכום", "תאריך תשלום"], ["1", "350", "06/10/2026"], ["1", "350", "06/10/2026"]];
    const first = await previewImport(db, "payments", buildingId, grid, "excel");
    expect(first.added).toBe(2);
    await applyImport(db, profileId, "payments", buildingId, `${tag}.csv`, grid, "excel");
    const second = await applyImport(db, profileId, "payments", buildingId, `${tag}.csv`, grid, "excel");
    expect(second.added).toBe(0);
    expect(second.unchanged).toBe(2);
    const { count } = await admin.from("payment").select("id", { count: "exact", head: true }).eq("building_id", buildingId).eq("source", "excel");
    expect(count).toBe(2);
    expect((await row(u1))?.balance).toBe(0);
  });

  it("unknown unit goes to unmatched", async () => {
    const grid = [["דירה", "סכום", "תאריך תשלום"], ["999", "100", "07/10/2026"]];
    const r = await applyImport(db, profileId, "payments", buildingId, `${tag}-2.csv`, grid, "bllink_import");
    expect(r.unmatched).toEqual([{ row: 2, unit: "999" }]);
    const unmatched = await loadUnmatched(db, buildingId);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].amount).toBe(10000);
    expect(unmatched[0].rawUnit).toBe("999");
    await linkPayment(db, unmatched[0].id, u3);
    expect(await loadUnmatched(db, buildingId)).toHaveLength(0);
    expect((await row(u3))?.paid).toBe(10000);
  });

  it("imports tariffs and counts changed rows", async () => {
    const grid = [["דירה", "10/2026"], ["2", "400"], ["1", "350"]];
    const p = await previewImport(db, "tariffs", buildingId, grid, "excel");
    expect(p).toMatchObject({ added: 1, changed: 0, unchanged: 1 });
    await applyImport(db, profileId, "tariffs", buildingId, `${tag}-t.csv`, grid, "excel");
    const again = await previewImport(db, "tariffs", buildingId, [["דירה", "10/2026"], ["2", "450"]], "excel");
    expect(again).toMatchObject({ added: 0, changed: 1, unchanged: 0 });
  });

  it("leaves archived units out of the ledger", async () => {
    await admin.from("unit").update({ archived_at: new Date().toISOString() }).eq("id", u2);
    expect(await row(u2)).toBeUndefined();
  });
});
