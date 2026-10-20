// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { completeRow } from "@/lib/db/complete";
import { loadToday } from "@/lib/db/today";
import { addDays, todayIL } from "@/lib/israel";

const today = todayIL(new Date());
const tag = `t5-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient, profileId: string, buildingId: string;
const itemIds: string[] = [];
const ticketIds: string[] = [];

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
  const { data } = await admin.from("building").insert({ name: `${tag} בניין` }).select("id").single();
  buildingId = data!.id;
});

afterAll(async () => {
  await admin.from("maintenance_log").delete().in("item_id", itemIds);
  await admin.from("ticket_event").delete().in("ticket_id", ticketIds);
  await admin.from("ticket").delete().in("id", ticketIds);
  await admin.from("maintenance_item").delete().in("id", itemIds);
  await admin.from("building").delete().eq("id", buildingId);
});

async function newItem(o: Record<string, unknown>) {
  const { data, error } = await admin.from("maintenance_item").insert({ building_id: buildingId, system: "הדברה", ...o }).select("id").single();
  if (error) throw error;
  itemIds.push(data!.id);
  return data!.id as string;
}
async function newTicket(o: Record<string, unknown>) {
  const { data, error } = await admin.from("ticket").insert({ kind: "task", category: "אחר", title: `${tag} משימה`, building_id: buildingId, ...o }).select("id").single();
  if (error) throw error;
  ticketIds.push(data!.id);
  return data!.id as string;
}

describe("completeRow", () => {
  it("maintenance: sets last done to today, next due from the frequency, and writes one log row", async () => {
    const id = await newItem({ frequency_unit: "month", frequency_count: 6, last_done_at: addDays(today, -190), next_due_at: addDays(today, -10) });
    await completeRow(db, profileId, "maintenance", id);
    const { data } = await admin.from("maintenance_item").select("last_done_at,next_due_at").eq("id", id).single();
    expect(data!.last_done_at).toBe(today);
    expect(data!.next_due_at > addDays(today, 170)).toBe(true);
    const { count } = await admin.from("maintenance_log").select("*", { count: "exact", head: true }).eq("item_id", id);
    expect(count).toBe(1);
  });

  it("a second call on the same day does not write a second log row", async () => {
    const id = await newItem({ system: "גינון", frequency_unit: "week", frequency_count: 1, next_due_at: today });
    await completeRow(db, profileId, "maintenance", id);
    await completeRow(db, profileId, "maintenance", id);
    const { count } = await admin.from("maintenance_log").select("*", { count: "exact", head: true }).eq("item_id", id);
    expect(count).toBe(1);
  });

  it("task: closes the ticket and writes a status event", async () => {
    const id = await newTicket({});
    await completeRow(db, profileId, "task", id);
    const { data } = await admin.from("ticket").select("status,closed_at").eq("id", id).single();
    expect(data!.status).toBe("בוצע");
    expect(data!.closed_at).not.toBeNull();
    const { count } = await admin.from("ticket_event").select("*", { count: "exact", head: true }).eq("ticket_id", id).eq("type", "status");
    expect(count).toBe(1);
  });

  it("task linked to a maintenance item also completes the item", async () => {
    const itemId = await newItem({ system: "משאבות", frequency_unit: "month", frequency_count: 3, next_due_at: addDays(today, -2) });
    const ticketId = await newTicket({ maintenance_item_id: itemId });
    await completeRow(db, profileId, "task", ticketId);
    const { data } = await admin.from("maintenance_item").select("last_done_at,next_due_at").eq("id", itemId).single();
    expect(data!.last_done_at).toBe(today);
    expect(data!.next_due_at).not.toBeNull();
  });
});

describe("loadToday", () => {
  it("does not return an archived item or an archived ticket", async () => {
    const itemId = await newItem({ system: "שער חניון", next_due_at: addDays(today, -3), last_done_at: addDays(today, -90), archived_at: new Date().toISOString() });
    const ticketId = await newTicket({ due_at: addDays(today, -1), archived_at: new Date().toISOString() });
    const data = await loadToday(db);
    const ids = [...data.overdue, ...data.soon, ...data.faults].map((r) => r.id);
    expect(ids).not.toContain(itemId);
    expect(ids).not.toContain(ticketId);
  });

  it("returns an overdue item with its building name", async () => {
    const id = await newItem({ system: "בדיקת גג", next_due_at: addDays(today, -4), last_done_at: addDays(today, -300) });
    const data = await loadToday(db);
    const row = data.overdue.find((r) => r.id === id);
    expect(row?.building).toBe(`${tag} בניין`);
  });

  it("does not return items of an archived building", async () => {
    const { data: b } = await admin.from("building").insert({ name: `${tag} ארכיון`, archived_at: new Date().toISOString() }).select("id").single();
    const { data: it } = await admin.from("maintenance_item").insert({ building_id: b!.id, system: "משאבות", next_due_at: addDays(today, -4), last_done_at: addDays(today, -100) }).select("id").single();
    itemIds.push(it!.id);
    const data = await loadToday(db);
    expect(data.overdue.map((r) => r.id)).not.toContain(it!.id);
    await admin.from("maintenance_item").delete().eq("id", it!.id);
    await admin.from("building").delete().eq("id", b!.id);
  });
});
