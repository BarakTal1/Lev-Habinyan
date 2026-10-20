// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { remindersDue, runReminders, type ReminderItem } from "@/lib/reminders";
import { setSetting } from "@/lib/db/people";
import { addDays, todayIL } from "@/lib/israel";

const today = "2026-10-20";
const item = (o: Partial<ReminderItem>): ReminderItem => ({
  id: "i1", building_name: "הירקון 112", system: "בדיקת מעלית", applicable: true, next_due_at: "2026-11-03", archived_at: null, ...o,
});

describe("remindersDue", () => {
  it("an item due in exactly 14 days gives before14", () => {
    expect(remindersDue([item({})], today, new Set())).toEqual([expect.objectContaining({ itemId: "i1", kind: "before14" })]);
  });
  it("an item due today gives due", () => {
    expect(remindersDue([item({ next_due_at: today })], today, new Set())).toEqual([expect.objectContaining({ itemId: "i1", kind: "due" })]);
  });
  it("an item due in 13 or 15 days gives nothing", () => {
    expect(remindersDue([item({ next_due_at: "2026-11-02" }), item({ id: "i2", next_due_at: "2026-11-04" })], today, new Set())).toEqual([]);
  });
  it("skips a reminder that was already sent", () => {
    expect(remindersDue([item({})], today, new Set(["i1:before14:2026-11-03"]))).toEqual([]);
  });
  it("skips not applicable, archived and no-date items", () => {
    expect(remindersDue([item({ applicable: false }), item({ id: "a", archived_at: "2026-01-01" }), item({ id: "n", next_due_at: null })], today, new Set())).toEqual([]);
  });
});

describe("runReminders", () => {
  let db: SupabaseClient, admin: SupabaseClient, buildingId: string, itemId: string;
  const tag = `t12-${Date.now()}`;
  const nowDate = new Date();

  beforeAll(async () => {
    ({ db } = await founderClient());
    admin = adminClient();
    const { data: b } = await admin.from("building").insert({ name: `${tag} בניין` }).select("id").single();
    buildingId = b!.id;
    const { data: i } = await admin.from("maintenance_item").insert({ building_id: buildingId, system: "בדיקת גג", last_done_at: addDays(todayIL(nowDate), -200), next_due_at: addDays(todayIL(nowDate), 14) }).select("id").single();
    itemId = i!.id;
  });
  afterAll(async () => {
    await admin.from("reminder_log").delete().eq("item_id", itemId);
    await admin.from("maintenance_item").delete().eq("id", itemId);
    await admin.from("building").delete().eq("id", buildingId);
    await setSetting(db, "email_reminders", false);
  });

  it("sends nothing when the setting is off", async () => {
    await setSetting(db, "email_reminders", false);
    const sent: unknown[] = [];
    const r = await runReminders(db, async (m) => { sent.push(m); }, nowDate);
    expect(r.sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("sends one digest to the founders when on, logs it, and does not repeat", async () => {
    await setSetting(db, "email_reminders", true);
    const sent: { to: string[]; subject: string; text: string }[] = [];
    const first = await runReminders(db, async (m) => { sent.push(m); }, nowDate);
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toContain("dev@lev.local");
    expect(sent[0].text).toContain(`${tag} בניין`);
    const { count } = await admin.from("reminder_log").select("*", { count: "exact", head: true }).eq("item_id", itemId);
    expect(count).toBe(1);
    const again = await runReminders(db, async (m) => { sent.push(m); }, nowDate);
    expect(again.sent).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("does not log a reminder when sending fails, so the next run retries", async () => {
    await admin.from("reminder_log").delete().eq("item_id", itemId);
    await setSetting(db, "email_reminders", true);
    await expect(runReminders(db, async () => { throw new Error("smtp down"); }, nowDate)).rejects.toThrow();
    const { count } = await admin.from("reminder_log").select("*", { count: "exact", head: true }).eq("item_id", itemId);
    expect(count).toBe(0);
  });
});
