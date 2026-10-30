// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "./helpers/db";
import { SimulatorChannel } from "@/lib/bot/channel";
import { normalizePhone } from "@/lib/bot/phone";
import {
  approveResident, countAgentChats, countPendingResidents, listAgentChats, listPendingResidents, rejectResident, replyInChat,
} from "@/lib/db/inbox";

const tag = `t-inbox-${Date.now()}`;
const rand = () => String(Math.floor(10000 + Math.random() * 89999));
const now = new Date("2026-10-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
let db: SupabaseClient, buildingId: string, channel: SimulatorChannel;
const phones: string[] = [];
const units: string[] = [];

beforeAll(async () => {
  db = adminClient();
  buildingId = (await db.from("building").insert({ name: `${tag} בניין` }).select("id").single()).data!.id;
});
beforeEach(() => { channel = new SimulatorChannel(); });

afterAll(async () => {
  const norms = phones.map((p) => normalizePhone(p)!);
  const people = ((await db.from("person").select("id").in("phone_norm", norms)).data ?? []).map((p) => p.id);
  const tickets = ((await db.from("ticket").select("id").in("reporter_id", people)).data ?? []).map((t) => t.id);
  await db.from("message_log").delete().in("phone", norms);
  await db.from("ticket_event").delete().in("ticket_id", tickets);
  await db.from("ticket").delete().in("id", tickets);
  await db.from("consent").delete().in("phone", norms);
  await db.from("unit_person").delete().in("unit_id", units);
  await db.from("person").delete().in("id", people);
  await db.from("unit").delete().in("id", units);
  await db.from("building").delete().eq("id", buildingId);
});

const newUnit = async (number: string) => { const id = (await db.from("unit").insert({ building_id: buildingId, number }).select("id").single()).data!.id as string; units.push(id); return id; };
/** A person linked to a unit. approvedAt null means the link waits for a founder. */
async function person(unit: string, o: { approvedAt: string | null; name?: string; relation?: "owner" | "tenant" }) {
  const phone = `05296${rand()}`;
  phones.push(phone);
  const id = (await db.from("person").insert({ name: o.name ?? `${tag} דייר`, phone, role: "resident" }).select("id").single()).data!.id as string;
  await db.from("unit_person").insert({ unit_id: unit, person_id: id, relation: o.relation ?? "owner", approved_at: o.approvedAt });
  return { id, phone };
}
const ticketOf = async (personId: string, over: Record<string, unknown> = {}) =>
  (await db.from("ticket").insert({ kind: "fault", category: "חשמל", title: `${tag} תקלה`, building_id: buildingId, reporter_id: personId, resident_approved: false, ...over }).select("id, number").single()).data!;
const chatRow = (phone: string, at: string, needsAgent = true, id = `${tag}-${rand()}`) =>
  db.from("message_log").insert({ direction: "in", phone: normalizePhone(phone)!, wa_message_id: id, body: "אפשר נציג?", needs_agent: needsAgent, created_at: at });

describe("pending residents", () => {
  it("lists a waiting resident with the apartment, the open tickets and no warning", async () => {
    const u = await newUnit("11");
    const p = await person(u, { approvedAt: null, name: `${tag} ממתינה` });
    const t = await ticketOf(p.id);
    const row = (await listPendingResidents(db)).find((r) => r.personId === p.id)!;
    expect(row).toMatchObject({ name: `${tag} ממתינה`, buildingName: `${tag} בניין`, unitNumber: "11", relation: "owner", ticketNumbers: [Number(t.number)], unitHasOtherResident: false });
  });

  it("warns when the apartment already has an approved resident", async () => {
    const u = await newUnit("12");
    await person(u, { approvedAt: new Date().toISOString(), name: `${tag} קיים` });
    const waiting = await person(u, { approvedAt: null, name: `${tag} חדש`, relation: "tenant" });
    expect((await listPendingResidents(db)).find((r) => r.personId === waiting.id)!.unitHasOtherResident).toBe(true);
  });

  it("does not list an approved or an archived resident", async () => {
    const u = await newUnit("13");
    const ok = await person(u, { approvedAt: new Date().toISOString() });
    const gone = await person(u, { approvedAt: null });
    await db.from("person").update({ archived_at: new Date().toISOString() }).eq("id", gone.id);
    const ids = (await listPendingResidents(db)).map((r) => r.personId);
    expect(ids).not.toContain(ok.id);
    expect(ids).not.toContain(gone.id);
  });

  it("approving sets the approval time and clears the flag on that person's tickets only", async () => {
    const u = await newUnit("14");
    const p = await person(u, { approvedAt: null });
    const other = await person(await newUnit("15"), { approvedAt: null });
    const t = await ticketOf(p.id), o = await ticketOf(other.id);
    await approveResident(db, p.id, u);
    expect((await db.from("unit_person").select("approved_at").eq("person_id", p.id).single()).data!.approved_at).not.toBeNull();
    expect((await db.from("ticket").select("resident_approved").eq("id", t.id).single()).data!.resident_approved).toBe(true);
    expect((await db.from("ticket").select("resident_approved").eq("id", o.id).single()).data!.resident_approved).toBe(false);
    expect((await listPendingResidents(db)).map((r) => r.personId)).not.toContain(p.id);
  });

  it("rejecting archives the person and keeps the tickets, still flagged", async () => {
    const u = await newUnit("16");
    const p = await person(u, { approvedAt: null });
    const t = await ticketOf(p.id);
    await rejectResident(db, p.id);
    expect((await db.from("person").select("archived_at").eq("id", p.id).single()).data!.archived_at).not.toBeNull();
    expect((await db.from("ticket").select("resident_approved").eq("id", t.id).single()).data!.resident_approved).toBe(false);
    expect((await listPendingResidents(db)).map((r) => r.personId)).not.toContain(p.id);
  });

  it("the count matches the list", async () => {
    expect(await countPendingResidents(db)).toBe((await listPendingResidents(db)).length);
  });
});

describe("agent chats", () => {
  it("lists a chat that asked for a person, once for each number, with the window state", async () => {
    const inside = `05296${rand()}`, outside = `05296${rand()}`;
    phones.push(inside, outside);
    await chatRow(inside, hoursAgo(2)); await chatRow(inside, hoursAgo(1));
    await chatRow(outside, hoursAgo(30));
    const chats = await listAgentChats(db, now);
    const a = chats.filter((c) => c.phone === normalizePhone(inside));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ insideWindow: true, lastMessage: "אפשר נציג?" });
    expect(chats.find((c) => c.phone === normalizePhone(outside))).toMatchObject({ insideWindow: false });
  });

  it("shows the name of a known resident", async () => {
    const u = await newUnit("17");
    const p = await person(u, { approvedAt: new Date().toISOString(), name: `${tag} דנה` });
    await chatRow(p.phone, hoursAgo(1));
    expect((await listAgentChats(db, now)).find((c) => c.phone === normalizePhone(p.phone))!.name).toBe(`${tag} דנה`);
  });

  it("a reply outside the window throws and sends nothing", async () => {
    const phone = `05296${rand()}`; phones.push(phone);
    await chatRow(phone, hoursAgo(30));
    await expect(replyInChat(db, channel, phone, "שלום", now)).rejects.toThrow(/window/);
    expect(channel.sent).toHaveLength(0);
    expect((await listAgentChats(db, now)).find((c) => c.phone === normalizePhone(phone))).toBeTruthy();
  });

  it("a reply inside the window sends the text, logs it, and clears the request", async () => {
    const phone = `05296${rand()}`; phones.push(phone);
    await chatRow(phone, hoursAgo(1)); await chatRow(phone, hoursAgo(2));
    await replyInChat(db, channel, phone, "  שלום, אני מחזיר לך תשובה  ", now);
    expect(channel.sent).toEqual([{ phone: normalizePhone(phone), out: { type: "text", body: "שלום, אני מחזיר לך תשובה" } }]);
    expect((await listAgentChats(db, now)).find((c) => c.phone === normalizePhone(phone))).toBeUndefined();
    expect((await db.from("message_log").select("delivery_state, body").eq("phone", normalizePhone(phone)!).eq("direction", "out")).data).toEqual([{ delivery_state: "sent", body: "שלום, אני מחזיר לך תשובה" }]);
  });

  it("refuses an empty reply", async () => {
    const phone = `05296${rand()}`; phones.push(phone);
    await chatRow(phone, hoursAgo(1));
    await expect(replyInChat(db, channel, phone, "   ", now)).rejects.toThrow();
  });

  it("the count matches the list", async () => {
    expect(await countAgentChats(db)).toBe((await listAgentChats(db, new Date())).length);
  });
});
