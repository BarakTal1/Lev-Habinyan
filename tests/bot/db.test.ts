// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../helpers/db";
import {
  findPersonByPhone, getSettings, isConsented, lastInboundAt, listBuildingsForBot, listOpenTicketsForPerson,
  loadConversation, recordConsent, recordOptOut, registerUnknown, saveConversation,
} from "@/lib/bot/db";
import { normalizePhone } from "@/lib/bot/phone";
import type { ChatState } from "@/lib/bot/types";

const tag = `t-botdb-${Date.now()}`;
const rand = () => String(Math.floor(10000 + Math.random() * 89999));
const phoneOf = () => `05299${rand()}`; // local form
let db: SupabaseClient;
let buildingA: string, buildingB: string, unitA: string, unitB: string;
const phones: string[] = [];
const newPhone = () => { const p = phoneOf(); phones.push(p); return p; };

beforeAll(async () => {
  db = adminClient();
  buildingA = (await db.from("building").insert({ name: `${tag} א`, address: "הרצל 5" }).select("id").single()).data!.id;
  buildingB = (await db.from("building").insert({ name: `${tag} ב` }).select("id").single()).data!.id;
  unitA = (await db.from("unit").insert({ building_id: buildingA, number: "3" }).select("id").single()).data!.id;
  unitB = (await db.from("unit").insert({ building_id: buildingB, number: "8" }).select("id").single()).data!.id;
});

afterAll(async () => {
  const norms = phones.map((p) => normalizePhone(p)!);
  const { data: people } = await db.from("person").select("id").in("phone_norm", norms);
  const ids = (people ?? []).map((p) => p.id);
  const { data: units } = await db.from("unit").select("id").in("building_id", [buildingA, buildingB]);
  const unitIds = (units ?? []).map((u) => u.id);
  await db.from("ticket_event").delete().in("ticket_id", (await db.from("ticket").select("id").like("title", `${tag}%`)).data?.map((t) => t.id) ?? []);
  await db.from("ticket").delete().like("title", `${tag}%`);
  await db.from("message_log").delete().in("phone", norms);
  await db.from("wa_conversation").delete().in("phone", norms);
  await db.from("consent").delete().in("phone", norms);
  await db.from("unit_person").delete().in("unit_id", unitIds);
  await db.from("person").delete().in("id", ids);
  await db.from("unit").delete().in("id", unitIds);
  await db.from("building").delete().in("id", [buildingA, buildingB]);
});

const link = (unit: string, person: string, approvedAt: string | null) => db.from("unit_person").insert({ unit_id: unit, person_id: person, relation: "owner", approved_at: approvedAt });

describe("findPersonByPhone", () => {
  it("finds one person from every form of the number", async () => {
    const p = newPhone();
    const dashed = `${p.slice(0, 3)}-${p.slice(3, 6)} ${p.slice(6)}`;
    const { data } = await db.from("person").insert({ name: `${tag} דנה`, phone: dashed, role: "resident" }).select("id").single();
    await link(unitA, data!.id, new Date().toISOString());
    for (const form of [p, dashed, `+972 ${p.slice(1, 3)} ${p.slice(3)}`, `972${p.slice(1)}`]) {
      expect((await findPersonByPhone(db, form))?.id).toBe(data!.id);
    }
    expect(await findPersonByPhone(db, "0521111111999")).toBeNull();
  });

  it("returns the most recently approved link of a person with two apartments", async () => {
    const p = newPhone();
    const { data } = await db.from("person").insert({ name: `${tag} רון`, phone: p, role: "resident" }).select("id").single();
    await link(unitA, data!.id, "2026-01-01T00:00:00Z");
    await link(unitB, data!.id, "2026-06-01T00:00:00Z");
    expect(await findPersonByPhone(db, p)).toMatchObject({ unitId: unitB, buildingId: buildingB, approved: true });
  });

  it("skips archived people", async () => {
    const p = newPhone();
    await db.from("person").insert({ name: `${tag} ארכיון`, phone: p, role: "resident", archived_at: new Date().toISOString() });
    expect(await findPersonByPhone(db, p)).toBeNull();
  });
});

describe("consent", () => {
  it("is false until granted, false after stop, true again after a new consent", async () => {
    const p = newPhone();
    const { data } = await db.from("person").insert({ name: `${tag} מיה`, phone: p, role: "resident" }).select("id").single();
    await link(unitA, data!.id, new Date().toISOString());
    expect((await findPersonByPhone(db, p))?.consented).toBe(false);
    await recordConsent(db, p, data!.id);
    expect(await findPersonByPhone(db, p)).toMatchObject({ consented: true, optedOut: false });
    await recordOptOut(db, p);
    expect(await findPersonByPhone(db, p)).toMatchObject({ consented: false, optedOut: true });
    await recordConsent(db, p, data!.id);
    expect(await findPersonByPhone(db, p)).toMatchObject({ consented: true, optedOut: false });
  });

  it("tracks consent of a number that is not a person yet", async () => {
    const p = newPhone();
    expect(await isConsented(db, p)).toBe(false);
    await recordConsent(db, p, null);
    expect(await isConsented(db, p)).toBe(true);
    expect(await findPersonByPhone(db, p)).toBeNull();
  });
});

describe("conversation state", () => {
  const state: ChatState = { step: "type", draft: { where: "common", place: "lobby", photoMediaIds: [], audioMediaIds: [] } };
  const t0 = new Date("2026-10-30T10:00:00Z");

  it("saves, loads, and forgets after 24 hours", async () => {
    const p = newPhone();
    await saveConversation(db, p, state, t0);
    expect(await loadConversation(db, p, new Date(t0.getTime() + 23 * 3600_000))).toEqual(state);
    expect(await loadConversation(db, p, new Date(t0.getTime() + 25 * 3600_000))).toBeNull();
  });

  it("saving null deletes the state", async () => {
    const p = newPhone();
    await saveConversation(db, p, state, t0);
    await saveConversation(db, p, null, t0);
    expect(await loadConversation(db, p, t0)).toBeNull();
  });

  it("keeps one row for each phone, in any written form", async () => {
    const p = newPhone();
    await saveConversation(db, p, state, t0);
    await saveConversation(db, `+972${p.slice(1)}`, { ...state, step: "danger" }, t0);
    expect((await loadConversation(db, p, t0))?.step).toBe("danger");
  });
});

describe("registerUnknown", () => {
  const draft = (over = {}) => ({ buildingId: buildingA, unitNumber: "03", name: `${tag} חדש`, relation: "tenant" as const, photoMediaIds: [], audioMediaIds: [], ...over });

  it("creates a person, reuses the unit, and leaves the link waiting for approval", async () => {
    const p1 = newPhone(), p2 = newPhone();
    const first = await registerUnknown(db, `972${p1.slice(1)}`, draft());
    const second = await registerUnknown(db, `972${p2.slice(1)}`, draft({ name: `${tag} שני`, relation: "committee" }));
    expect(first.personId).not.toBe(second.personId);
    const { data: units } = await db.from("unit").select("id, number").eq("building_id", buildingA);
    expect(units!.filter((u) => u.number === "3" || u.number === "03")).toHaveLength(1);
    const { data: links } = await db.from("unit_person").select("person_id, relation, is_committee, approved_at").in("person_id", [first.personId, second.personId]);
    expect(links).toHaveLength(2);
    expect(links!.every((l) => l.approved_at === null)).toBe(true);
    expect(links!.find((l) => l.person_id === first.personId)!.relation).toBe("tenant");
    expect(links!.find((l) => l.person_id === second.personId)!.is_committee).toBe(true);
    expect(await findPersonByPhone(db, p1)).toMatchObject({ id: first.personId, approved: false });
  });

  it("creates a unit that does not exist", async () => {
    const p = newPhone();
    await registerUnknown(db, p, draft({ unitNumber: "41" }));
    const { data } = await db.from("unit").select("id").eq("building_id", buildingA).eq("number", "41");
    expect(data).toHaveLength(1);
  });
});

describe("lists", () => {
  it("lists buildings with their address", async () => {
    const list = await listBuildingsForBot(db);
    expect(list.find((b) => b.id === buildingA)).toMatchObject({ name: `${tag} א`, address: "הרצל 5" });
  });

  it("lists only the open tickets of the person, with the visit time", async () => {
    const p = newPhone();
    const person = (await db.from("person").insert({ name: `${tag} תקלות`, phone: p, role: "resident" }).select("id").single()).data!.id;
    const mk = (n: string, status: string, extra = {}) => db.from("ticket").insert({ kind: "fault", category: "חשמל", title: `${tag} ${n}`, status, reporter_id: person, building_id: buildingA, ...extra });
    await mk("פתוחה", "חדש");
    await mk("סגורה", "בוצע");
    await mk("עם ביקור", "הוקצה", { scheduled_at: "2026-11-02T08:30:00Z" });
    const list = await listOpenTicketsForPerson(db, person);
    expect(list.map((t) => t.typeLabel).sort()).toEqual([`${tag} פתוחה`, `${tag} עם ביקור`].sort());
    expect(list.find((t) => t.typeLabel.endsWith("עם ביקור"))!.visit).toBe("02/11 10:30");
    expect(list.find((t) => t.typeLabel.endsWith("פתוחה"))!.visit).toBeNull();
  });
});

describe("settings and last inbound", () => {
  it("returns safe defaults when nothing is set", async () => {
    const s = await getSettings(db);
    expect(Array.isArray(s.oncallPhones)).toBe(true);
    expect(s.emergencyNumber === null || typeof s.emergencyNumber === "string").toBe(true);
  });

  it("reads the time of the last message from the resident", async () => {
    const p = newPhone();
    const norm = normalizePhone(p)!;
    expect(await lastInboundAt(db, p)).toBeNull();
    await db.from("message_log").insert([
      { direction: "in", phone: norm, wa_message_id: `${tag}-a`, body: "א", created_at: "2026-10-30T09:00:00Z" },
      { direction: "in", phone: norm, wa_message_id: `${tag}-b`, body: "ב", created_at: "2026-10-30T09:30:00Z" },
      { direction: "out", phone: norm, wa_message_id: `${tag}-c`, body: "ג", created_at: "2026-10-30T09:45:00Z" },
    ]);
    expect((await lastInboundAt(db, p))?.toISOString()).toBe("2026-10-30T09:30:00.000Z");
  });
});
