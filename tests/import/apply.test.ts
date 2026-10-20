// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "../helpers/db";
import { applyImport } from "@/lib/import/apply";
import { parseControlSheet } from "@/lib/import/controlSheet";

const tag = `t11-${Date.now()}`;
const header = "בניין,ניקיון,גינון,מעלית,כיבוי אש,הדברה,חשמל,אינסטלציה,ביוב,גג,משאבות,מים,שער";
let db: SupabaseClient, admin: SupabaseClient;
const names = [`${tag} א`, `${tag} ב`];

beforeAll(async () => {
  ({ db } = await founderClient());
  admin = adminClient();
});

afterAll(async () => {
  const { data: bs } = await admin.from("building").select("id").in("name", names);
  const ids = (bs ?? []).map((b) => b.id);
  await admin.from("maintenance_item").delete().in("building_id", ids);
  await admin.from("building").delete().in("id", ids);
});

const items = async (name: string) => {
  const { data: b } = await admin.from("building").select("id").eq("name", name).single();
  const { data } = await admin.from("maintenance_item").select("system, applicable, frequency_unit, frequency_count, last_done_at, next_due_at").eq("building_id", b!.id);
  return new Map(data!.map((i) => [i.system, i]));
};

describe("applyImport", () => {
  it("creates new buildings, all 12 items, and sets frequency, last date and next date", async () => {
    const csv = `${header}\n${names[0]},שבועי,-,,חצי שנתי 08.04.26,,,,,,,,\n${names[1]},,,,,,,,,,,,`;
    const r = await applyImport(db, parseControlSheet(csv).rows);
    expect(r).toEqual({ buildings: 2, created: 2, items: 24 });
    const a = await items(names[0]);
    expect(a.size).toBe(12);
    expect(a.get("ניקיון")).toMatchObject({ applicable: true, frequency_unit: "week", frequency_count: 1, last_done_at: null, next_due_at: null });
    expect(a.get("גינון")!.applicable).toBe(false);
    expect(a.get("בדיקת כיבוי אש")).toMatchObject({ frequency_unit: "month", frequency_count: 6, last_done_at: "2026-04-08", next_due_at: "2026-10-08" });
    expect((await items(names[1])).size).toBe(12);
  });

  it("importing again reuses the building and does not wipe data with empty cells", async () => {
    const csv = `${header}\n${names[0]},,,,,,,,,,,,`;
    const r = await applyImport(db, parseControlSheet(csv).rows);
    expect(r).toEqual({ buildings: 1, created: 0, items: 12 });
    const a = await items(names[0]);
    expect(a.get("בדיקת כיבוי אש")).toMatchObject({ frequency_unit: "month", frequency_count: 6, last_done_at: "2026-04-08" });
    const { data } = await admin.from("building").select("id").eq("name", names[0]);
    expect(data).toHaveLength(1);
  });
});
