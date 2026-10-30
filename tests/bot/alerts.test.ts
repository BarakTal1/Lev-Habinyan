// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../helpers/db";
import { runAlertRepeats, sendDangerAlert } from "@/lib/bot/alerts";
import { getSettings } from "@/lib/bot/db";
import { SimulatorChannel } from "@/lib/bot/channel";
import { FakeSms, SmsNotConfigured, makeSmsFromEnv } from "@/lib/bot/sms";
import { GET } from "@/app/api/cron/alerts/route";

const tag = `t-alerts-${Date.now()}`;
const PHONES = ["972529000111", "972529000222"]; // Roy and Omer in the test
let db: SupabaseClient, buildingId: string, savedOncall: unknown;
const t0 = new Date("2026-10-30T12:00:00Z");
const minutes = (n: number) => new Date(t0.getTime() + n * 60_000);

const dangerTicket = async (over: Record<string, unknown> = {}) =>
  (await db.from("ticket").insert({ kind: "fault", category: "חשמל", title: `${tag} חשמל · חדר מדרגות`, urgency: "סכנה", building_id: buildingId, ...over }).select("id").single()).data!.id as string;
const inbound = (phone: string, at: Date) => db.from("message_log").insert({ direction: "in", phone, wa_message_id: `${tag}-${phone}-${at.getTime()}`, body: "שלום", created_at: at.toISOString() });
const rows = async (ticketId: string) => (await db.from("alert").select("channel, to_phone, delivery_state, repeat_of, id").eq("ticket_id", ticketId).order("sent_at")).data!;

beforeAll(async () => {
  db = adminClient();
  buildingId = (await db.from("building").insert({ name: `${tag} בניין` }).select("id").single()).data!.id;
  savedOncall = (await db.from("setting").select("value").eq("key", "oncall_phones").maybeSingle()).data?.value;
  process.env.SITE_URL = "https://app.example.test";
});

beforeEach(async () => {
  await db.from("setting").upsert({ key: "oncall_phones", value: PHONES });
  await db.from("message_log").delete().in("phone", PHONES);
});

afterEach(() => { delete process.env.CRON_SECRET; });

afterAll(async () => {
  const ids = ((await db.from("ticket").select("id").like("title", `${tag}%`)).data ?? []).map((t) => t.id);
  const alerts = ((await db.from("alert").select("id, repeat_of").in("ticket_id", ids)).data ?? []);
  await db.from("alert").delete().in("id", alerts.filter((a) => a.repeat_of).map((a) => a.id));
  await db.from("alert").delete().in("ticket_id", ids);
  await db.from("ticket").delete().in("id", ids);
  await db.from("message_log").delete().in("phone", PHONES);
  await db.from("building").delete().eq("id", buildingId);
  if (savedOncall === undefined) await db.from("setting").delete().eq("key", "oncall_phones");
  else await db.from("setting").upsert({ key: "oncall_phones", value: savedOncall });
});

describe("sendDangerAlert", () => {
  it("sends WhatsApp and SMS to both phones and records one row for each", async () => {
    await Promise.all(PHONES.map((p) => inbound(p, minutes(-60))));
    const channel = new SimulatorChannel(), sms = new FakeSms();
    const id = await dangerTicket();
    await sendDangerAlert(db, channel, sms, id, undefined, t0);
    expect(channel.sent.map((s) => s.phone).sort()).toEqual(PHONES);
    expect(sms.sent.map((s) => s.to).sort()).toEqual(PHONES);
    expect(sms.sent[0].body).toContain(`https://app.example.test/tickets/${id}`);
    expect(sms.sent[0].body).toContain(`${tag} בניין`);
    const r = await rows(id);
    expect(r).toHaveLength(4);
    expect(r.every((x) => x.delivery_state === "sent" && x.repeat_of === null)).toBe(true);
  });

  it("records the WhatsApp alert as failed for a phone outside the 24-hour window, and still sends the SMS", async () => {
    await inbound(PHONES[0], minutes(-60));
    await inbound(PHONES[1], minutes(-60 * 25));
    const channel = new SimulatorChannel(), sms = new FakeSms();
    const id = await dangerTicket();
    await sendDangerAlert(db, channel, sms, id, undefined, t0);
    expect(channel.sent.map((s) => s.phone)).toEqual([PHONES[0]]);
    expect(sms.sent).toHaveLength(2);
    const wa = (await rows(id)).filter((x) => x.channel === "whatsapp");
    expect(wa.find((x) => x.to_phone === PHONES[1])!.delivery_state).toBe("failed");
  });

  it("an SMS error still sends WhatsApp and records the SMS as failed", async () => {
    await Promise.all(PHONES.map((p) => inbound(p, minutes(-5))));
    const channel = new SimulatorChannel(), sms = new FakeSms({ fail: true });
    const id = await dangerTicket();
    await expect(sendDangerAlert(db, channel, sms, id, undefined, t0)).resolves.toBeUndefined();
    expect(channel.sent).toHaveLength(2);
    const r = await rows(id);
    expect(r.filter((x) => x.channel === "sms").every((x) => x.delivery_state === "failed")).toBe(true);
    expect(r.filter((x) => x.channel === "whatsapp").every((x) => x.delivery_state === "sent")).toBe(true);
  });

  it("a WhatsApp error still sends the SMS", async () => {
    await Promise.all(PHONES.map((p) => inbound(p, minutes(-5))));
    const channel = new SimulatorChannel();
    channel.send = async () => { throw new Error("graph error"); };
    const sms = new FakeSms();
    const id = await dangerTicket();
    await sendDangerAlert(db, channel, sms, id, undefined, t0);
    expect(sms.sent).toHaveLength(2);
    expect((await rows(id)).filter((x) => x.channel === "whatsapp").every((x) => x.delivery_state === "failed")).toBe(true);
  });

  it("sends nothing and records nothing when no on-call phone is set", async () => {
    await db.from("setting").upsert({ key: "oncall_phones", value: [] });
    const sms = new FakeSms();
    const id = await dangerTicket();
    await sendDangerAlert(db, new SimulatorChannel(), sms, id, undefined, t0);
    expect(sms.sent).toHaveLength(0);
    expect(await rows(id)).toHaveLength(0);
  });
});

describe("runAlertRepeats", () => {
  const first = async (id: string) => sendDangerAlert(db, new SimulatorChannel(), new FakeSms(), id, undefined, t0);

  it("repeats once after 10 minutes and not before", async () => {
    const id = await dangerTicket();
    await first(id);
    const channel = new SimulatorChannel(), sms = new FakeSms();
    expect(await runAlertRepeats(db, channel, sms, minutes(9))).toEqual({ repeated: 0 });
    expect((await rows(id)).filter((x) => x.repeat_of)).toHaveLength(0);
    await runAlertRepeats(db, channel, sms, minutes(11));
    const afterRepeat = await rows(id);
    expect(afterRepeat.filter((x) => x.repeat_of)).toHaveLength(4);
    expect(new Set(afterRepeat.filter((x) => x.repeat_of).map((x) => x.repeat_of)).size).toBe(1);
    await runAlertRepeats(db, channel, sms, minutes(30));
    expect((await rows(id)).filter((x) => x.repeat_of)).toHaveLength(4);
  });

  it("does not repeat when a founder already acted on the ticket", async () => {
    const id = await dangerTicket();
    await first(id);
    await db.from("ticket").update({ first_action_at: minutes(3).toISOString(), status: "בטיפול" }).eq("id", id);
    await runAlertRepeats(db, new SimulatorChannel(), new FakeSms(), minutes(15));
    expect((await rows(id)).filter((x) => x.repeat_of)).toHaveLength(0);
  });

  it("does not repeat for a ticket that was closed or archived", async () => {
    const closed = await dangerTicket();
    const archived = await dangerTicket();
    await first(closed); await first(archived);
    await db.from("ticket").update({ status: "בוצע" }).eq("id", closed);
    await db.from("ticket").update({ archived_at: t0.toISOString() }).eq("id", archived);
    await runAlertRepeats(db, new SimulatorChannel(), new FakeSms(), minutes(15));
    expect((await rows(closed)).filter((x) => x.repeat_of)).toHaveLength(0);
    expect((await rows(archived)).filter((x) => x.repeat_of)).toHaveLength(0);
  });
});

describe("on-call phones", () => {
  // This file owns the oncall_phones setting while it runs, so no other test file changes it at the same time.
  it("with no setting, fall back to the phones of the founders; an explicit list wins", async () => {
    await db.from("setting").delete().eq("key", "oncall_phones");
    const phone = `05297${String(Math.floor(10000 + Math.random() * 89999))}`;
    const founder = (await db.from("person").insert({ name: `${tag} מייסד`, phone, role: "founder" }).select("id").single()).data!.id;
    try {
      expect((await getSettings(db)).oncallPhones).toContain(phone);
      await db.from("setting").upsert({ key: "oncall_phones", value: ["0501234567"] });
      expect((await getSettings(db)).oncallPhones).toEqual(["0501234567"]);
    } finally {
      await db.from("person").delete().eq("id", founder);
    }
  });
});

describe("makeSmsFromEnv", () => {
  it("throws SmsNotConfigured when no key is set", () => {
    delete process.env.SMS_API_KEY;
    expect(() => makeSmsFromEnv()).toThrow(SmsNotConfigured);
  });
});

describe("cron alerts route", () => {
  const req = (auth?: string) => new Request("http://x/api/cron/alerts", { headers: auth ? { authorization: auth } : {} });
  it("rejects a request with no secret configured, a wrong secret, and a missing header", async () => {
    expect((await GET(req("Bearer anything"))).status).toBe(401);
    process.env.CRON_SECRET = "right";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
  });
});
