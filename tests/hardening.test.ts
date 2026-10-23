// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { ensureItems, markDone } from "@/lib/db/maintenance";
import { createTicket, uploadAttachment } from "@/lib/db/tickets";
import { remindersDue, type ReminderItem } from "@/lib/reminders";
import { describeEdit } from "@/lib/ticketEvents";
import { todayIL } from "@/lib/israel";

const tag = `hard-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient, profileId: string, buildingId: string, itemId: string;
const ticketIds: string[] = [];

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
  const { data: b } = await admin.from("building").insert({ name: `${tag} בניין` }).select("id").single();
  buildingId = b!.id;
  await ensureItems(db, buildingId);
  const { data: i } = await admin.from("maintenance_item").select("id").eq("building_id", buildingId).limit(1).single();
  itemId = i!.id;
});

afterAll(async () => {
  await admin.from("maintenance_log").delete().eq("item_id", itemId);
  await admin.from("attachment").delete().in("ticket_id", ticketIds);
  await admin.from("ticket_event").delete().in("ticket_id", ticketIds);
  await admin.from("ticket").delete().in("id", ticketIds);
  await admin.from("maintenance_item").delete().eq("building_id", buildingId);
  await admin.from("building").delete().eq("id", buildingId);
});

describe("maintenance log", () => {
  it("the database refuses a second log row for the same item and day", async () => {
    const day = "2026-01-05";
    const first = await admin.from("maintenance_log").insert({ item_id: itemId, done_at: day });
    expect(first.error).toBeNull();
    const second = await admin.from("maintenance_log").insert({ item_id: itemId, done_at: day });
    expect(second.error).not.toBeNull();
  });

  it("markDone rejects an invalid or future date", async () => {
    await expect(markDone(db, profileId, itemId, { done_at: "not-a-date" })).rejects.toThrow(/date/);
    await expect(markDone(db, profileId, itemId, { done_at: "2999-01-01" })).rejects.toThrow(/date/);
    await expect(markDone(db, profileId, itemId, { done_at: "2026-02-31" })).rejects.toThrow(/date/);
  });

  it("markDone accepts today", async () => {
    await expect(markDone(db, profileId, itemId, { done_at: todayIL(new Date()) })).resolves.toBeDefined();
  });
});

describe("uploads", () => {
  it("rejects a file type that is not an image or a document", async () => {
    const t = await createTicket(db, profileId, { kind: "task", title: `${tag} a`, category: "אחר" });
    ticketIds.push(t.id);
    const exe = new File([new Uint8Array(10)], "x.exe", { type: "application/x-msdownload" });
    await expect(uploadAttachment(db, profileId, t.id, "document", exe)).rejects.toThrow(/type/);
  });

  it("rejects a file over the size limit", async () => {
    const t = await createTicket(db, profileId, { kind: "task", title: `${tag} b`, category: "אחר" });
    ticketIds.push(t.id);
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    await expect(uploadAttachment(db, profileId, t.id, "photo", big)).rejects.toThrow(/large/);
  });

  it("accepts a small photo", async () => {
    const t = await createTicket(db, profileId, { kind: "task", title: `${tag} c`, category: "אחר" });
    ticketIds.push(t.id);
    const ok = new File([new Uint8Array(100)], "a.jpg", { type: "image/jpeg" });
    await expect(uploadAttachment(db, profileId, t.id, "photo", ok)).resolves.toBeUndefined();
  });
});

describe("reminders after a missed day", () => {
  const today = "2026-10-20";
  const item = (o: Partial<ReminderItem>): ReminderItem => ({
    id: "i1", building_name: "הירקון 112", system: "בדיקת מעלית", applicable: true, next_due_at: "2026-11-03", archived_at: null, ...o,
  });
  it("an item that was due 2 days ago still gives due", () => {
    expect(remindersDue([item({ next_due_at: "2026-10-18" })], today, new Set())).toEqual([expect.objectContaining({ kind: "due", due: "2026-10-18" })]);
  });
  it("an item due in 12 days still gives before14", () => {
    expect(remindersDue([item({ next_due_at: "2026-11-01" })], today, new Set())).toEqual([expect.objectContaining({ kind: "before14" })]);
  });
  it("an item that was due 10 days ago gives nothing", () => {
    expect(remindersDue([item({ next_due_at: "2026-10-10" })], today, new Set())).toEqual([]);
  });
  it("a reminder sent on the first day is not sent again on the next day", () => {
    expect(remindersDue([item({ next_due_at: "2026-10-19" })], today, new Set(["i1:due:2026-10-19"]))).toEqual([]);
  });
});

describe("timeline text for an edit", () => {
  it("shows Hebrew field names, not column names", () => {
    expect(describeEdit({ title: "x", due_at: "2026-01-01", scheduled_at: null })).toBe("כותרת, תאריך יעד, זמן ביקור");
  });
  it("keeps an unknown key as it is", () => {
    expect(describeEdit({ zzz: 1 })).toBe("zzz");
  });
});
