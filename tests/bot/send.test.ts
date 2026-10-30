// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../helpers/db";
import { SimulatorChannel } from "@/lib/bot/channel";
import { recordConsent } from "@/lib/bot/db";
import { normalizePhone } from "@/lib/bot/phone";
import { changeStatus, getResident, previewForInfo, previewForStatus, previewForVisit, sendTicketMessage } from "@/lib/bot/send";
import { getTicket } from "@/lib/db/tickets";

const tag = `t-send-${Date.now()}`;
const rand = () => String(Math.floor(10000 + Math.random() * 89999));
let db: SupabaseClient, buildingId: string, unitId: string, founder: string;
let channel: SimulatorChannel;
const phones: string[] = [];
const tickets: string[] = [];
const now = new Date("2026-10-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

beforeAll(async () => {
  db = adminClient();
  buildingId = (await db.from("building").insert({ name: `${tag} בניין` }).select("id").single()).data!.id;
  unitId = (await db.from("unit").insert({ building_id: buildingId, number: "4" }).select("id").single()).data!.id;
  founder = (await db.from("profile").select("id").eq("email", "dev@lev.local").single()).data!.id;
});
beforeEach(() => { channel = new SimulatorChannel(); });

afterAll(async () => {
  await db.from("message_log").delete().in("ticket_id", tickets);
  await db.from("message_log").delete().in("phone", phones.map((p) => normalizePhone(p)!));
  await db.from("ticket_event").delete().in("ticket_id", tickets);
  await db.from("ticket").delete().in("id", tickets);
  await db.from("consent").delete().in("phone", phones.map((p) => normalizePhone(p)!));
  const people = ((await db.from("person").select("id").in("phone_norm", phones.map((p) => normalizePhone(p)!))).data ?? []).map((p) => p.id);
  await db.from("unit_person").delete().in("person_id", people);
  await db.from("person").delete().in("id", people);
  await db.from("unit").delete().eq("id", unitId);
  await db.from("building").delete().eq("id", buildingId);
});

/** A ticket with a resident. `inboundHoursAgo` is when the resident last wrote; null means never. */
async function setup(o: { consent?: boolean; inboundHoursAgo?: number | null; reporter?: boolean; status?: string; scheduled?: string } = {}) {
  const phone = `05297${rand()}`;
  phones.push(phone);
  const person = (await db.from("person").insert({ name: `${tag} דנה`, phone, role: "resident" }).select("id").single()).data!.id;
  await db.from("unit_person").insert({ unit_id: unitId, person_id: person, relation: "owner" });
  if (o.consent !== false) await recordConsent(db, phone, person);
  if (o.inboundHoursAgo !== null) await db.from("message_log").insert({ direction: "in", phone: normalizePhone(phone)!, wa_message_id: `${tag}-${phone}`, body: "שלום", created_at: hoursAgo(o.inboundHoursAgo ?? 1) });
  const t = (await db.from("ticket").insert({
    kind: "fault", category: "חשמל", title: `${tag} תקלה`, building_id: buildingId, status: o.status ?? "חדש", reporter_id: o.reporter === false ? null : person, scheduled_at: o.scheduled ?? null,
  }).select("id, number").single()).data!;
  tickets.push(t.id);
  return { phone, person, id: t.id as string, number: Number(t.number) };
}
const logs = async (id: string) => (await db.from("message_log").select("direction, delivery_state, template_name, body, error").eq("ticket_id", id).eq("direction", "out")).data!;

describe("previews", () => {
  it("has no preview for a status without a template", async () => {
    const t = await setup();
    expect(await previewForStatus(db, t.id, "בטיפול", now)).toBeNull();
  });

  it("builds the assigned and done previews for a resident with consent", async () => {
    const t = await setup();
    const assigned = await previewForStatus(db, t.id, "הוקצה", now);
    expect(assigned).toMatchObject({ template: "ticket_assigned", params: [`${tag} דנה`, String(t.number)], editable: true });
    expect(await previewForStatus(db, t.id, "בוצע", now)).toMatchObject({ template: "ticket_done", params: [String(t.number)] });
  });

  it("has no preview when the resident has no consent, no reporter, or no phone", async () => {
    expect(await previewForStatus(db, (await setup({ consent: false })).id, "הוקצה", now)).toBeNull();
    expect(await previewForStatus(db, (await setup({ reporter: false })).id, "הוקצה", now)).toBeNull();
    const t = await setup();
    await db.from("person").update({ phone: null }).eq("id", t.person);
    expect(await previewForStatus(db, t.id, "הוקצה", now)).toBeNull();
  });

  it("is locked outside the 24-hour window", async () => {
    const t = await setup({ inboundHoursAgo: 30 });
    expect((await previewForStatus(db, t.id, "הוקצה", now))!.editable).toBe(false);
    const never = await setup({ inboundHoursAgo: null });
    expect((await previewForStatus(db, never.id, "הוקצה", now))!.editable).toBe(false);
  });

  it("builds the visit preview from the visit time in Israel time, with a two-hour window", async () => {
    const t = await setup({ scheduled: "2026-11-02T08:30:00Z" }); // 10:30 in Israel
    expect(await previewForVisit(db, t.id, now)).toMatchObject({ template: "ticket_visit", params: [String(t.number), "02/11", "10:30", "12:30"] });
    expect(await previewForVisit(db, (await setup()).id, now)).toBeNull();
  });

  it("builds the info preview and refuses an empty question", async () => {
    const t = await setup();
    expect(await previewForInfo(db, t.id, "  מה מספר הדירה?  ", now)).toMatchObject({ template: "ticket_info", params: [String(t.number), "מה מספר הדירה?"] });
    await expect(previewForInfo(db, t.id, "   ", now)).rejects.toThrow();
  });
});

describe("getResident", () => {
  it("returns the reporter with consent, or null", async () => {
    const t = await setup();
    expect(await getResident(db, t.id)).toMatchObject({ name: `${tag} דנה`, consented: true });
    expect(await getResident(db, (await setup({ reporter: false })).id)).toBeNull();
  });
});

describe("sendTicketMessage", () => {
  it("sends the edited text inside the window, logs it, and writes a message event", async () => {
    const t = await setup();
    const preview = (await previewForStatus(db, t.id, "הוקצה", now))!;
    const r = await sendTicketMessage(db, channel, founder, t.id, preview, "  שלום דנה, שלחנו מישהו  ");
    expect(r.delivery).toBe("sent");
    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0].out).toEqual({ type: "text", body: "שלום דנה, שלחנו מישהו" });
    expect((await logs(t.id))[0]).toMatchObject({ delivery_state: "sent", body: "שלום דנה, שלחנו מישהו" });
    const detail = (await getTicket(db, t.id))!;
    const ev = detail.events.find((e) => e.type === "message")!;
    expect(ev.payload).toMatchObject({ text: "שלום דנה, שלחנו מישהו", delivery_state: "sent" });
  });

  it("inside the window, an unedited message goes out as plain text, so it works before Meta approves a template", async () => {
    const t = await setup();
    const preview = (await previewForStatus(db, t.id, "הוקצה", now))!;
    await sendTicketMessage(db, channel, founder, t.id, preview);
    expect(channel.sent[0].out).toEqual({ type: "text", body: preview.text });
    expect((await logs(t.id))[0].template_name).toBeNull();
  });

  it("keeps the yes/no buttons when the done message is edited", async () => {
    const t = await setup();
    const preview = (await previewForStatus(db, t.id, "בוצע", now))!;
    await sendTicketMessage(db, channel, founder, t.id, preview, "טיפלנו. הכול תקין?");
    const out = channel.sent[0].out;
    expect(out.type).toBe("buttons");
    expect((out as Extract<typeof out, { type: "buttons" }>).buttons.map((b) => b.id)).toEqual([`done_yes:${t.number}`, `done_no:${t.number}`]);
  });

  it("sends the template, and ignores an edited text, outside the window", async () => {
    const t = await setup({ inboundHoursAgo: 30 });
    const preview = (await previewForStatus(db, t.id, "הוקצה", now))!;
    await sendTicketMessage(db, channel, founder, t.id, preview, "טקסט חופשי שאסור לשלוח");
    expect(channel.sent[0].out).toEqual({ type: "template", name: "ticket_assigned", params: preview.params });
    expect((await logs(t.id))[0].template_name).toBe("ticket_assigned");
  });

  it("returns failed, and logs it, when the channel errors", async () => {
    const t = await setup();
    channel.send = async () => { throw new Error("graph down"); };
    const preview = (await previewForStatus(db, t.id, "הוקצה", now))!;
    expect((await sendTicketMessage(db, channel, founder, t.id, preview)).delivery).toBe("failed");
    expect((await logs(t.id))[0]).toMatchObject({ delivery_state: "failed", error: "graph down" });
    expect((await getTicket(db, t.id))!.events.find((e) => e.type === "message")!.payload).toMatchObject({ delivery_state: "failed" });
  });

  it("refuses a resident without consent", async () => {
    const t = await setup({ consent: false });
    const preview = { template: "ticket_assigned" as const, params: ["a", "1"], text: "x", editable: true };
    expect((await sendTicketMessage(db, channel, founder, t.id, preview)).delivery).toBe("failed");
    expect(channel.sent).toHaveLength(0);
  });
});

describe("changeStatus", () => {
  it("changes the status and sends the message when asked", async () => {
    const t = await setup();
    const r = await changeStatus(db, channel, founder, t.id, "הוקצה", { send: {} }, now);
    expect(r.delivery).toBe("sent");
    expect((await db.from("ticket").select("status").eq("id", t.id).single()).data!.status).toBe("הוקצה");
    expect(channel.sent).toHaveLength(1);
  });

  it("changes the status without a message and records that it was skipped", async () => {
    const t = await setup();
    const r = await changeStatus(db, channel, founder, t.id, "הוקצה", {}, now);
    expect(r.delivery).toBeNull();
    expect(channel.sent).toHaveLength(0);
    const ev = (await getTicket(db, t.id))!.events.filter((e) => e.type === "status");
    expect(ev.at(-1)!.payload).toMatchObject({ to: "הוקצה", skippedMessage: true });
  });

  it("does not record a skip for a status that has no template", async () => {
    const t = await setup();
    await changeStatus(db, channel, founder, t.id, "בטיפול", {}, now);
    const ev = (await getTicket(db, t.id))!.events.filter((e) => e.type === "status");
    expect(ev.at(-1)!.payload.skippedMessage).toBeUndefined();
  });

  it("changes the status even when the send fails", async () => {
    const t = await setup();
    channel.send = async () => { throw new Error("down"); };
    const r = await changeStatus(db, channel, founder, t.id, "בוצע", { send: {} }, now);
    expect(r.delivery).toBe("failed");
    expect((await db.from("ticket").select("status").eq("id", t.id).single()).data!.status).toBe("בוצע");
  });

  it("sends nothing when the resident cannot be messaged, but still changes the status", async () => {
    const t = await setup({ consent: false });
    const r = await changeStatus(db, channel, founder, t.id, "הוקצה", { send: {} }, now);
    expect(r.delivery).toBeNull();
    expect(channel.sent).toHaveLength(0);
    expect((await db.from("ticket").select("status").eq("id", t.id).single()).data!.status).toBe("הוקצה");
  });
});
