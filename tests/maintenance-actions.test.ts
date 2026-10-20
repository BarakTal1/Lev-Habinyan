// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { completeRow } from "@/lib/db/complete";
import { createTaskFromItem, ensureItems, loadBuildingMaintenance, loadPortfolio, markDone, updateItem } from "@/lib/db/maintenance";
import { addDays, todayIL } from "@/lib/israel";
import { SYSTEMS } from "@/lib/labels";

const tag = `t8-${Date.now()}`;
const today = todayIL(new Date());
let db: SupabaseClient, admin: SupabaseClient, profileId: string;
const buildingIds: string[] = [];

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
});

afterAll(async () => {
  for (const id of buildingIds) {
    const { data: items } = await admin.from("maintenance_item").select("id").eq("building_id", id);
    const ids = (items ?? []).map((i) => i.id);
    await admin.from("maintenance_log").delete().in("item_id", ids);
    const { data: ts } = await admin.from("ticket").select("id").in("maintenance_item_id", ids);
    const tids = (ts ?? []).map((t) => t.id);
    await admin.from("ticket_event").delete().in("ticket_id", tids);
    await admin.from("ticket").delete().in("id", tids);
    await admin.from("maintenance_item").delete().eq("building_id", id);
    await admin.from("building").delete().eq("id", id);
  }
});

const newBuilding = async () => {
  const { data } = await admin.from("building").insert({ name: `${tag} בניין ${buildingIds.length}` }).select("id").single();
  buildingIds.push(data!.id);
  return data!.id as string;
};
const item = async (b: string, system: string) => (await admin.from("maintenance_item").select("id").eq("building_id", b).eq("system", system).single()).data!.id as string;

describe("ensureItems", () => {
  it("creates exactly the 12 systems and is idempotent", async () => {
    const b = await newBuilding();
    await ensureItems(db, b);
    await ensureItems(db, b);
    const { data } = await admin.from("maintenance_item").select("system").eq("building_id", b);
    expect(data).toHaveLength(12);
    expect(new Set(data!.map((d) => d.system))).toEqual(new Set(SYSTEMS));
  });
});

describe("markDone", () => {
  it("with a 6 month frequency sets the next date and writes one log row", async () => {
    const b = await newBuilding();
    await ensureItems(db, b);
    const id = await item(b, "בדיקת מעלית");
    await updateItem(db, id, { frequency_unit: "month", frequency_count: 6 });
    const r = await markDone(db, profileId, id, { done_at: "2026-10-08", note: "נבדק" });
    expect(r).toEqual({ next_due_at: "2027-04-08", needsFrequency: false });
    const { count } = await admin.from("maintenance_log").select("*", { count: "exact", head: true }).eq("item_id", id);
    expect(count).toBe(1);
  });

  it("with no frequency keeps next date empty, stays nodata and asks for a frequency", async () => {
    const b = await newBuilding();
    await ensureItems(db, b);
    const id = await item(b, "בדיקת גג");
    const r = await markDone(db, profileId, id, { done_at: today });
    expect(r).toEqual({ next_due_at: null, needsFrequency: true });
    const rows = await loadBuildingMaintenance(db, b);
    expect(rows.find((x) => x.id === id)!.state).toBe("nodata");
  });
});

describe("updateItem", () => {
  it("setting applicable=false makes the state na and removes it from Today", async () => {
    const b = await newBuilding();
    await ensureItems(db, b);
    const id = await item(b, "גינון");
    await updateItem(db, id, { next_due_at: addDays(today, -5), last_done_at: addDays(today, -50) });
    expect((await loadBuildingMaintenance(db, b)).find((x) => x.id === id)!.state).toBe("overdue");
    await updateItem(db, id, { applicable: false });
    expect((await loadBuildingMaintenance(db, b)).find((x) => x.id === id)!.state).toBe("na");
    const { loadToday } = await import("@/lib/db/today");
    expect((await loadToday(db)).overdue.map((r) => r.id)).not.toContain(id);
  });
});

describe("createTaskFromItem", () => {
  it("creates a linked task and completing it from Today completes the item", async () => {
    const b = await newBuilding();
    await ensureItems(db, b);
    const id = await item(b, "משאבות");
    await updateItem(db, id, { frequency_unit: "month", frequency_count: 3, next_due_at: addDays(today, 5), last_done_at: addDays(today, -85) });
    const { ticketId } = await createTaskFromItem(db, profileId, id);
    const { data: t } = await admin.from("ticket").select("kind, title, building_id, maintenance_item_id, due_at").eq("id", ticketId).single();
    expect(t).toEqual({ kind: "task", title: "משאבות", building_id: b, maintenance_item_id: id, due_at: addDays(today, 5) });
    await completeRow(db, profileId, "task", ticketId);
    const { data: i } = await admin.from("maintenance_item").select("last_done_at").eq("id", id).single();
    expect(i!.last_done_at).toBe(today);
  });

  it("does not create a second open task for the same item", async () => {
    const b = await newBuilding();
    await ensureItems(db, b);
    const id = await item(b, "הדברה");
    const a = await createTaskFromItem(db, profileId, id);
    const c = await createTaskFromItem(db, profileId, id);
    expect(c.ticketId).toBe(a.ticketId);
  });
});

describe("loadPortfolio", () => {
  it("returns one row per building with 12 cells, missing items as nodata", async () => {
    const b = await newBuilding();
    const rows = await loadPortfolio(db);
    const row = rows.find((r) => r.id === b)!;
    expect(row.cells).toHaveLength(12);
    expect(row.cells.every((c) => c.state === "nodata")).toBe(true);
  });
});
