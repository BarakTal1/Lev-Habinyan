// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/whatsapp/webhook/route";
import { adminClient, SERVICE } from "../helpers/db";

const SECRET = "test-app-secret";
const tag = `t-webhook-${Date.now()}`;
const phone = `97252${String(Math.floor(1000000 + Math.random() * 8999999))}`;
const db = adminClient();
const sign = (raw: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
const textPayload = (id: string, body = "שלום") => JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages: [{ id, from: phone, timestamp: "1761465600", type: "text", text: { body } }] } }] }],
});
const post = (raw: string, signature: string | null) =>
  POST(new Request("http://x/api/whatsapp/webhook", { method: "POST", body: raw, headers: signature ? { "x-hub-signature-256": signature } : {} }));
const get = (query: string) => GET(new Request(`http://x/api/whatsapp/webhook?${query}`));

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
  process.env.WHATSAPP_CHANNEL = "simulator";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
});
afterEach(() => {
  for (const k of ["WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_CHANNEL"]) delete process.env[k];
});
afterAll(async () => {
  await db.from("message_log").delete().eq("phone", phone);
  await db.from("wa_conversation").delete().eq("phone", phone);
});

describe("webhook verification (GET)", () => {
  it("echoes the challenge when the token matches", async () => {
    const r = await get("hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("12345");
  });
  it("refuses a wrong token, a wrong mode, and a missing configured token", async () => {
    expect((await get("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1")).status).toBe(403);
    expect((await get("hub.mode=unsubscribe&hub.verify_token=verify-me&hub.challenge=1")).status).toBe(403);
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    expect((await get("hub.mode=subscribe&hub.verify_token=&hub.challenge=1")).status).toBe(403);
  });
});

describe("webhook messages (POST)", () => {
  it("rejects a bad signature with 401 and does not process the message", async () => {
    const raw = textPayload(`${tag}-bad`);
    expect((await post(raw, sign(raw, "other-secret"))).status).toBe(401);
    expect((await post(raw, null)).status).toBe(401);
    expect((await db.from("message_log").select("id").eq("wa_message_id", `${tag}-bad`)).data).toHaveLength(0);
  });

  it("answers 503 when the app secret is not configured, and never skips the check", async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const raw = textPayload(`${tag}-nosecret`);
    expect((await post(raw, sign(raw))).status).toBe(503);
    expect((await db.from("message_log").select("id").eq("wa_message_id", `${tag}-nosecret`)).data).toHaveLength(0);
  });

  it("rejects a body that is not JSON", async () => {
    const raw = "not json";
    expect((await post(raw, sign(raw))).status).toBe(400);
  });

  it("processes a signed message once, even when it is delivered twice", async () => {
    const raw = textPayload(`${tag}-ok`);
    expect((await post(raw, sign(raw))).status).toBe(200);
    expect((await post(raw, sign(raw))).status).toBe(200);
    const rows = (await db.from("message_log").select("direction").eq("phone", phone).eq("wa_message_id", `${tag}-ok`)).data!;
    expect(rows).toEqual([{ direction: "in" }]);
    // The number is new, so the bot asked for consent: one outbound reply.
    expect((await db.from("message_log").select("id").eq("phone", phone).eq("direction", "out")).data).toHaveLength(1);
  });

  it("answers 200 for a status update of an unknown message", async () => {
    const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", statuses: [{ id: `${tag}-nope`, status: "delivered", recipient_id: phone }] } }] }] });
    expect((await post(raw, sign(raw))).status).toBe(200);
  });
});
