// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../helpers/db";
import { handleInbound, handleStatus, sendGuarded, type Deps } from "@/lib/bot/handler";
import { SimulatorChannel } from "@/lib/bot/channel";
import { listBuildingsForBot, recordConsent } from "@/lib/bot/db";
import { normalizePhone } from "@/lib/bot/phone";
import { proposeFields } from "@/lib/bot/propose";
import { hoursText } from "@/lib/bot/settings";
import { bot } from "@/lib/bot/texts";
import type { Inbound, Out } from "@/lib/bot/types";

const tag = `t-handler-${Date.now()}`;
const rand = () => String(Math.floor(10000 + Math.random() * 89999));
let db: SupabaseClient, buildingId: string, unitId: string;
let channel: SimulatorChannel;
let alerts: string[];
let deps: Deps;
let seq = 0;
const phones: string[] = [];
const newPhone = () => { const p = `05298${rand()}`; phones.push(p); return p; };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

beforeAll(async () => {
  db = adminClient();
  buildingId = (await db.from("building").insert({ name: `${tag} בניין`, address: `${tag} רחוב 5` }).select("id").single()).data!.id;
  unitId = (await db.from("unit").insert({ building_id: buildingId, number: "3" }).select("id").single()).data!.id;
});

beforeEach(() => {
  channel = new SimulatorChannel();
  alerts = [];
  deps = { db, channel, now: () => new Date(), propose: proposeFields, alert: async (id) => { alerts.push(id); } };
});

afterAll(async () => {
  const norms = phones.map((p) => normalizePhone(p)!);
  const people = ((await db.from("person").select("id").in("phone_norm", norms)).data ?? []).map((p) => p.id);
  const tickets = ((await db.from("ticket").select("id").in("reporter_id", people)).data ?? []).map((t) => t.id);
  const paths = ((await db.from("attachment").select("storage_path").in("ticket_id", tickets)).data ?? []).map((a) => a.storage_path);
  if (paths.length) await db.storage.from("attachments").remove(paths);
  await db.from("message_log").delete().in("phone", norms);
  await db.from("proposal_log").delete().in("ticket_id", tickets);
  await db.from("attachment").delete().in("ticket_id", tickets);
  await db.from("ticket_event").delete().in("ticket_id", tickets);
  await db.from("alert").delete().in("ticket_id", tickets);
  await db.from("ticket").update({ duplicate_of_id: null }).in("id", tickets);
  await db.from("ticket").delete().in("id", tickets);
  await db.from("wa_conversation").delete().in("phone", norms);
  await db.from("consent").delete().in("phone", norms);
  await db.from("unit_person").delete().in("person_id", people);
  await db.from("person").delete().in("id", people);
  const units = ((await db.from("unit").select("id").eq("building_id", buildingId)).data ?? []).map((u) => u.id);
  await db.from("unit_person").delete().in("unit_id", units);
  await db.from("unit").delete().in("id", units);
  await db.from("building").delete().eq("id", buildingId);
});

/** A resident who writes to the bot. */
function resident(phone: string) {
  const say = async (content: Inbound, waMessageId = `${tag}-${++seq}`) => handleInbound(deps, { waMessageId, phone, at: new Date().toISOString(), content });
  const sentToMe = () => channel.sent.filter((s) => s.phone === normalizePhone(phone)).map((s) => s.out);
  const bodyOf = (o: Out | undefined) => (o && "body" in o ? o.body : "");
  return {
    say,
    text: (t: string) => say({ kind: "text", text: t }),
    btn: (id: string) => say({ kind: "button", id }),
    sentToMe,
    last: () => bodyOf(sentToMe().at(-1)),
    lastOut: () => sentToMe().at(-1),
  };
}

async function knownResident(opts: { approved?: boolean; consent?: boolean } = {}) {
  const phone = newPhone();
  const person = (await db.from("person").insert({ name: `${tag} דיירת`, phone, role: "resident" }).select("id").single()).data!.id;
  await db.from("unit_person").insert({ unit_id: unitId, person_id: person, relation: "owner", approved_at: opts.approved === false ? null : new Date().toISOString() });
  if (opts.consent !== false) await recordConsent(db, phone, person);
  return { phone, person, chat: resident(phone) };
}

const ticketsOf = async (person: string) => (await db.from("ticket").select("*").eq("reporter_id", person).order("created_at")).data!;

/** Report a fault from the menu to the confirm button. */
async function report(chat: ReturnType<typeof resident>, o: { where: "unit" | "common"; place?: string; type: string; danger?: boolean; text?: string; mediaId?: string }) {
  await chat.text("שלום");
  await chat.btn("report");
  await chat.btn(o.where);
  if (o.where === "common") await chat.btn(o.place ?? "lobby");
  await chat.btn(o.type);
  await chat.btn(o.danger ? "danger_yes" : "danger_no");
  if (o.mediaId) await chat.say({ kind: "image", mediaId: o.mediaId, caption: o.text });
  else await chat.text(o.text ?? "תיאור קצר");
  await chat.btn("confirm");
}

describe("a known resident reports a fault", () => {
  it("asks for consent, then creates one ticket with a photo and a proposal", async () => {
    const { phone, person, chat } = await knownResident({ consent: false });
    channel.media.set("m1", { bytes: jpeg, mime: "image/jpeg" });
    await chat.text("שלום");
    expect(chat.lastOut()).toMatchObject({ type: "buttons" });
    expect((chat.lastOut() as Extract<Out, { type: "buttons" }>).buttons[0].id).toBe("consent");
    expect((await ticketsOf(person)).length).toBe(0);
    await chat.btn("consent");
    await chat.btn("report"); await chat.btn("unit"); await chat.btn("plumbing"); await chat.btn("danger_no");
    await chat.say({ kind: "image", mediaId: "m1", caption: "דליפה מהצנרת" });
    await chat.btn("confirm");

    const [t] = await ticketsOf(person);
    const expected = proposeFields({ typeId: "plumbing", where: "unit", text: "דליפה מהצנרת" });
    expect(await ticketsOf(person)).toHaveLength(1);
    expect(t).toMatchObject({
      source: "whatsapp", kind: "fault", title: expected.title, category: "אינסטלציה", urgency: expected.urgency, responsibility: "לא ידוע",
      building_id: buildingId, unit_id: unitId, resident_approved: true, original_message: "דליפה מהצנרת", duplicate_of_id: null, created_by: null,
    });
    expect((await db.from("attachment").select("kind").eq("ticket_id", t.id)).data).toEqual([{ kind: "photo" }]);
    const proposal = (await db.from("proposal_log").select("proposed").eq("ticket_id", t.id)).data!;
    expect(proposal).toHaveLength(1);
    expect(proposal[0].proposed).toMatchObject({ title: expected.title });
    expect(chat.last()).toBe(bot.ticketCreated(Number(t.number)));
    expect(alerts).toEqual([]);
    expect(phone).toBeTruthy();
  });

  it("a redelivered message creates one ticket and one reply", async () => {
    const { person, chat } = await knownResident();
    await chat.text("שלום"); await chat.btn("report"); await chat.btn("unit"); await chat.btn("electric"); await chat.btn("danger_no"); await chat.text("אין חשמל");
    await chat.say({ kind: "button", id: "confirm" }, `${tag}-same`);
    const sentBefore = channel.sent.length;
    await chat.say({ kind: "button", id: "confirm" }, `${tag}-same`);
    expect(await ticketsOf(person)).toHaveLength(1);
    expect(channel.sent.length).toBe(sentBefore);
  });

  it("danger sets urgency סכנה, raises the alert once, and answers with the danger text", async () => {
    await db.from("setting").upsert({ key: "emergency_number", value: "100" });
    try {
      const { person, chat } = await knownResident();
      await report(chat, { where: "common", place: "lobby", type: "lift", danger: true, text: "תקוע במעלית" });
      const [t] = await ticketsOf(person);
      expect(t.urgency).toBe("סכנה");
      expect(alerts).toEqual([t.id]);
      expect(chat.sentToMe().map((o) => ("body" in o ? o.body : "")).some((b) => b.includes("100"))).toBe(true);
    } finally {
      await db.from("setting").delete().eq("key", "emergency_number");
    }
  });

  it("links a second report of the same common-area fault to the open ticket", async () => {
    const { person, chat } = await knownResident();
    const other = await knownResident();
    await report(chat, { where: "common", place: "stairs", type: "electric", text: "נורה שרופה" });
    const [first] = await ticketsOf(person);
    await report(other.chat, { where: "common", place: "stairs", type: "electric", text: "אין אור במדרגות" });
    const [second] = await ticketsOf(other.person);
    expect(second.duplicate_of_id).toBe(first.id);
    expect(other.chat.last()).toBe(bot.alreadyOpen(Number(first.number), first.status));
    expect(first.duplicate_of_id).toBeNull();
  });

  it("does not link two reports from different apartments", async () => {
    const a = await knownResident(), b = await knownResident();
    await report(a.chat, { where: "unit", type: "plumbing", text: "דליפה" });
    await report(b.chat, { where: "unit", type: "plumbing", text: "דליפה" });
    expect((await ticketsOf(b.person))[0].duplicate_of_id).toBeNull();
  });

  it("still creates the ticket when a photo cannot be downloaded", async () => {
    const { person, chat } = await knownResident();
    await report(chat, { where: "unit", type: "other", text: "משהו", mediaId: "missing" });
    expect(await ticketsOf(person)).toHaveLength(1);
    expect((await db.from("attachment").select("id").eq("ticket_id", (await ticketsOf(person))[0].id)).data).toEqual([]);
  });

  it("flags the ticket of a resident who is not approved yet", async () => {
    const { person, chat } = await knownResident({ approved: false });
    await report(chat, { where: "unit", type: "gate", text: "השער תקוע" });
    expect((await ticketsOf(person))[0].resident_approved).toBe(false);
  });
});

describe("an unknown number", () => {
  it("identifies itself, waits for approval, and its ticket shows not approved", async () => {
    const phone = newPhone();
    const chat = resident(phone);
    await chat.text("שלום");
    await chat.btn("consent");
    const buildings = await listBuildingsForBot(db);
    if (buildings.length < 10) await chat.btn(buildingId); else await chat.text(`${tag} רחוב`);
    await chat.text("7");
    await chat.text(`${tag} חדשה`);
    await chat.btn("tenant");
    const person = (await db.from("person").select("id").eq("phone_norm", normalizePhone(phone)!).single()).data!.id;
    const links = (await db.from("unit_person").select("approved_at, relation").eq("person_id", person)).data!;
    expect(links).toEqual([{ approved_at: null, relation: "tenant" }]);
    await chat.btn("report"); await chat.btn("unit"); await chat.btn("gate"); await chat.btn("danger_no"); await chat.text("השער"); await chat.btn("confirm");
    const [t] = await ticketsOf(person);
    expect(t).toMatchObject({ source: "whatsapp", resident_approved: false, building_id: buildingId });
  });

  it("never creates a second person when the same number writes again", async () => {
    const phone = newPhone();
    const chat = resident(phone);
    await chat.text("שלום"); await chat.btn("consent");
    await chat.text("שלום");
    expect((await db.from("person").select("id").eq("phone_norm", normalizePhone(phone)!)).data).toHaveLength(0);
  });
});

describe("stop and the agent", () => {
  it("stop opts out, and the next message asks for consent before anything else", async () => {
    const { person, chat } = await knownResident();
    await chat.text("שלום");
    await chat.text("stop");
    expect((await db.from("person").select("opted_out_at").eq("id", person).single()).data!.opted_out_at).not.toBeNull();
    const before = channel.sent.length;
    await chat.text("שלום");
    const replies = channel.sent.slice(before).map((s) => s.out);
    expect(replies).toHaveLength(1);
    expect((replies[0] as Extract<Out, { type: "buttons" }>).buttons[0].id).toBe("consent");
  });

  it("an agent request marks the message for the inbox", async () => {
    const { chat } = await knownResident();
    await chat.text("שלום");
    await chat.say({ kind: "button", id: "agent" }, `${tag}-agent`);
    const row = (await db.from("message_log").select("needs_agent").eq("wa_message_id", `${tag}-agent`).single()).data!;
    expect(row.needs_agent).toBe(true);
  });
});

describe("working hours", () => {
  const todayIndex = () => {
    const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short" }).format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(d);
  };
  const withHours = async (value: unknown, run: () => Promise<void>) => {
    const saved = (await db.from("setting").select("value").eq("key", "working_hours").maybeSingle()).data?.value;
    await db.from("setting").upsert({ key: "working_hours", value });
    try { await run(); } finally {
      if (saved === undefined) await db.from("setting").delete().eq("key", "working_hours"); else await db.from("setting").upsert({ key: "working_hours", value: saved });
    }
  };

  it("outside the hours an agent request gets the closed message with the hours", async () => {
    const hours = { days: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== todayIndex()), from: "08:00", to: "18:00" };
    await withHours(hours, async () => {
      const { chat } = await knownResident();
      await chat.text("שלום"); await chat.btn("agent");
      expect(chat.last()).toBe(bot.agentClosed(hoursText(hours)));
    });
  });

  it("inside the hours an agent request gets no closed message", async () => {
    const hours = { days: [0, 1, 2, 3, 4, 5, 6], from: "00:00", to: "23:59" };
    await withHours(hours, async () => {
      const { chat } = await knownResident();
      await chat.text("שלום"); await chat.btn("agent");
      expect(chat.sentToMe().map((o) => ("body" in o ? o.body : "")).some((b) => b.includes("הצוות לא זמין"))).toBe(false);
    });
  });
});

describe("the answer to ticket_done", () => {
  const closedTicket = async (person: string) =>
    (await db.from("ticket").insert({ kind: "fault", category: "חשמל", title: `${tag} סגורה`, status: "בוצע", closed_at: new Date().toISOString(), reporter_id: person, building_id: buildingId }).select("id, number").single()).data!;

  it("yes records the confirmation and leaves the ticket closed", async () => {
    const { person, chat } = await knownResident();
    const t = await closedTicket(person);
    await chat.btn(`done_yes:${t.number}`);
    expect((await db.from("ticket").select("status").eq("id", t.id).single()).data!.status).toBe("בוצע");
    expect((await db.from("ticket_event").select("type, payload").eq("ticket_id", t.id).eq("type", "message")).data).toHaveLength(1);
    expect(chat.last()).toBe(bot.doneThanks);
  });

  it("no reopens the ticket", async () => {
    const { person, chat } = await knownResident();
    const t = await closedTicket(person);
    await chat.btn(`done_no:${t.number}`);
    const after = (await db.from("ticket").select("status, closed_at").eq("id", t.id).single()).data!;
    expect(after).toEqual({ status: "נפתח מחדש", closed_at: null });
    expect(chat.last()).toBe(bot.reopened);
  });

  it("does not reopen the ticket of another resident", async () => {
    const owner = await knownResident(), stranger = await knownResident();
    const t = await closedTicket(owner.person);
    await stranger.chat.btn(`done_no:${t.number}`);
    expect((await db.from("ticket").select("status").eq("id", t.id).single()).data!.status).toBe("בוצע");
  });
});

describe("sendGuarded", () => {
  it("refuses a message that is not a reply to a number without consent, and logs the refusal", async () => {
    const phone = newPhone();
    const r = await sendGuarded(deps, phone, { type: "text", body: "שלום" }, { reply: false });
    expect(r.sent).toBe(false);
    expect(channel.sent).toHaveLength(0);
    const log = (await db.from("message_log").select("delivery_state, error").eq("phone", normalizePhone(phone)!).eq("direction", "out")).data!;
    expect(log).toEqual([{ delivery_state: "failed", error: "no consent" }]);
  });

  it("sends a reply without consent, and sends to a number with consent", async () => {
    const phone = newPhone();
    expect((await sendGuarded(deps, phone, { type: "text", body: "תשובה" }, { reply: true })).sent).toBe(true);
    const consented = newPhone();
    await recordConsent(db, consented, null);
    expect((await sendGuarded(deps, consented, { type: "text", body: "עדכון" }, { reply: false })).sent).toBe(true);
  });

  it("refuses a number that sent stop", async () => {
    const { phone, chat } = await knownResident();
    await chat.text("שלום"); await chat.text("stop");
    const before = channel.sent.length;
    expect((await sendGuarded(deps, phone, { type: "text", body: "עדכון" }, { reply: false })).sent).toBe(false);
    expect(channel.sent.length).toBe(before);
  });

  it("logs a send error as failed and does not throw", async () => {
    const phone = newPhone();
    channel.send = async () => { throw new Error("graph error 131047"); };
    const r = await sendGuarded(deps, phone, { type: "text", body: "תשובה" }, { reply: true });
    expect(r.sent).toBe(false);
    expect((await db.from("message_log").select("delivery_state, error").eq("phone", normalizePhone(phone)!).eq("direction", "out")).data).toEqual([{ delivery_state: "failed", error: "graph error 131047" }]);
  });
});

describe("handleStatus", () => {
  const mk = async (state: string) => {
    const id = `${tag}-out-${++seq}`;
    await db.from("message_log").insert({ direction: "out", phone: normalizePhone(newPhone())!, wa_message_id: id, delivery_state: state });
    return id;
  };
  const stateOf = async (id: string) => (await db.from("message_log").select("delivery_state, error").eq("wa_message_id", id).single()).data!;

  it("moves a message forward and ignores a late older status", async () => {
    const id = await mk("sent");
    await handleStatus(db, { waMessageId: id, state: "read" });
    await handleStatus(db, { waMessageId: id, state: "delivered" });
    expect((await stateOf(id)).delivery_state).toBe("read");
  });

  it("records a failure with its error", async () => {
    const id = await mk("sent");
    await handleStatus(db, { waMessageId: id, state: "failed", error: "131026" });
    expect(await stateOf(id)).toEqual({ delivery_state: "failed", error: "131026" });
  });

  it("ignores a status for a message it does not know", async () => {
    await expect(handleStatus(db, { waMessageId: `${tag}-unknown`, state: "delivered" })).resolves.toBeUndefined();
  });
});
