import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCloudWebhook, verifySignature, CloudApiChannel } from "@/lib/bot/cloudApi";
import { SimulatorChannel, getChannel } from "@/lib/bot/channel";

const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", n), "utf8"));
const wrapMsg = (m: object) => ({ entry: [{ changes: [{ value: { messages: [m] } }] }] });

describe("parseCloudWebhook", () => {
  it("parses text", () => {
    const r = parseCloudWebhook(fx("cloud-text.json"));
    expect(r.statuses).toEqual([]);
    expect(r.messages).toEqual([{ waMessageId: "wamid.TEXT1", phone: "972501234567", at: new Date(1761465600 * 1000).toISOString(), content: { kind: "text", text: "שלום" } }]);
  });
  it("parses button reply", () => {
    expect(parseCloudWebhook(fx("cloud-button.json")).messages[0].content).toEqual({ kind: "button", id: "menu_report" });
  });
  it("parses list reply", () => {
    const m = wrapMsg({ id: "w", from: "972500000000", timestamp: "1", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "row_1", title: "x" } } });
    expect(parseCloudWebhook(m).messages[0].content).toEqual({ kind: "button", id: "row_1" });
  });
  it("parses image with caption", () => {
    expect(parseCloudWebhook(fx("cloud-image.json")).messages[0].content).toEqual({ kind: "image", mediaId: "media-img-1", caption: "הנזילה" });
  });
  it("parses audio", () => {
    const m = wrapMsg({ id: "w", from: "972500000000", timestamp: "1", type: "audio", audio: { id: "aud-1" } });
    expect(parseCloudWebhook(m).messages[0].content).toEqual({ kind: "audio", mediaId: "aud-1" });
  });
  it("maps sticker and location to other", () => {
    for (const type of ["sticker", "location"]) {
      expect(parseCloudWebhook(wrapMsg({ id: "w", from: "972500000000", timestamp: "1", type })).messages[0].content).toEqual({ kind: "other" });
    }
  });
  it("parses statuses", () => {
    const r = parseCloudWebhook(fx("cloud-status.json"));
    expect(r.messages).toEqual([]);
    expect(r.statuses).toEqual([
      { waMessageId: "wamid.OUT1", state: "failed", error: "Message undeliverable" },
      { waMessageId: "wamid.OUT2", state: "delivered" },
    ]);
  });
  it("tolerates garbage", () => {
    expect(parseCloudWebhook(null)).toEqual({ messages: [], statuses: [] });
    expect(parseCloudWebhook({ entry: "x" })).toEqual({ messages: [], statuses: [] });
  });
});

describe("verifySignature", () => {
  const body = '{"a":1}';
  const good = "sha256=" + createHmac("sha256", "sec").update(body).digest("hex");
  it("accepts a valid signature", () => expect(verifySignature(body, good, "sec")).toBe(true));
  it("rejects bad input without throwing", () => {
    expect(verifySignature(body, null, "sec")).toBe(false);
    expect(verifySignature(body, good, "other")).toBe(false);
    expect(verifySignature(body, good.replace("sha256=", "sha1="), "sec")).toBe(false);
    expect(verifySignature(body, "sha256=abcd", "sec")).toBe(false);
    expect(verifySignature(body, "sha256=" + "zz".repeat(32), "sec")).toBe(false);
    expect(verifySignature(body + " ", good, "sec")).toBe(false);
  });
});

describe("CloudApiChannel", () => {
  const mk = () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.SENT" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, ch: new CloudApiChannel({ token: "tok", phoneNumberId: "123", fetch: fetchFn }) };
  };
  const bodyOf = (c: { init: RequestInit }) => JSON.parse(c.init.body as string);

  it("sends text", async () => {
    const { calls, ch } = mk();
    const r = await ch.send("972501234567", { type: "text", body: "hi" });
    expect(r).toEqual({ waMessageId: "wamid.SENT" });
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(bodyOf(calls[0])).toEqual({ messaging_product: "whatsapp", to: "972501234567", type: "text", text: { body: "hi" } });
  });
  it("sends buttons", async () => {
    const { calls, ch } = mk();
    await ch.send("1", { type: "buttons", body: "b", buttons: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
    expect(bodyOf(calls[0]).interactive).toEqual({ type: "button", body: { text: "b" }, action: { buttons: [
      { type: "reply", reply: { id: "a", title: "A" } }, { type: "reply", reply: { id: "b", title: "B" } }] } });
  });
  it("sends list", async () => {
    const { calls, ch } = mk();
    await ch.send("1", { type: "list", body: "b", button: "בחר", rows: [{ id: "r1", title: "R1" }] });
    expect(bodyOf(calls[0]).interactive).toEqual({ type: "list", body: { text: "b" }, action: { button: "בחר", sections: [{ title: "בחר", rows: [{ id: "r1", title: "R1" }] }] } });
  });
  it("sends template with positional params", async () => {
    const { calls, ch } = mk();
    await ch.send("1", { type: "template", name: "ticket_done", params: ["12", "x"] });
    expect(bodyOf(calls[0]).template).toEqual({ name: "ticket_done", language: { code: "he" }, components: [
      { type: "body", parameters: [{ type: "text", text: "12" }, { type: "text", text: "x" }] }] });
  });
  it("throws on HTTP error", async () => {
    const ch = new CloudApiChannel({ token: "t", phoneNumberId: "1", fetch: (async () => new Response("no", { status: 400 })) as unknown as typeof fetch });
    await expect(ch.send("1", { type: "text", body: "x" })).rejects.toThrow();
  });
  it("fetches media in two steps", async () => {
    const urls: string[] = [];
    const fetchFn = (async (url: string) => {
      urls.push(url);
      if (url.includes("graph.facebook.com")) return new Response(JSON.stringify({ url: "https://cdn/x", mime_type: "image/jpeg" }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await new CloudApiChannel({ token: "t", phoneNumberId: "1", fetch: fetchFn }).fetchMedia("m1");
    expect(urls).toEqual(["https://graph.facebook.com/v21.0/m1", "https://cdn/x"]);
    expect(r.mime).toBe("image/jpeg");
    expect(Array.from(r.bytes)).toEqual([1, 2, 3]);
  });
});

describe("SimulatorChannel and getChannel", () => {
  it("records sends", async () => {
    const s = new SimulatorChannel();
    const r = await s.send("1", { type: "text", body: "x" });
    expect(r.waMessageId).toBeNull();
    expect(s.sent).toEqual([{ phone: "1", out: { type: "text", body: "x" } }]);
  });
  it("fetchMedia reads the media map", async () => {
    const s = new SimulatorChannel();
    s.media.set("m", { bytes: new Uint8Array([9]), mime: "audio/ogg" });
    expect((await s.fetchMedia("m")).mime).toBe("audio/ogg");
    await expect(s.fetchMedia("none")).rejects.toThrow();
  });
  it("getChannel picks by env", () => {
    const keep = { ...process.env };
    try {
      delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID; delete process.env.WHATSAPP_CHANNEL;
      const a = getChannel();
      expect(a).toBeInstanceOf(SimulatorChannel);
      expect(getChannel()).toBe(a);
      process.env.WHATSAPP_TOKEN = "t"; process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
      expect(getChannel()).toBeInstanceOf(CloudApiChannel);
      process.env.WHATSAPP_CHANNEL = "simulator";
      expect(getChannel()).toBe(a);
    } finally { process.env = keep; }
  });
});
