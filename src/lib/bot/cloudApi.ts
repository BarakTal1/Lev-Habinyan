import { createHmac, timingSafeEqual } from "node:crypto";
import type { Channel } from "./channel";
import type { Inbound, InboundMessage, Out } from "./types";

export type StatusUpdate = { waMessageId: string; state: "sent" | "delivered" | "read" | "failed"; error?: string };

const GRAPH = "https://graph.facebook.com/v21.0";
const STATES = ["sent", "delivered", "read", "failed"];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function parseContent(m: Rec): Inbound {
  switch (m.type) {
    case "text": {
      const body = isRec(m.text) ? str(m.text.body) : undefined;
      return body === undefined ? { kind: "other" } : { kind: "text", text: body };
    }
    case "interactive": {
      const i = isRec(m.interactive) ? m.interactive : {};
      const reply = isRec(i.button_reply) ? i.button_reply : isRec(i.list_reply) ? i.list_reply : null;
      const id = reply ? str(reply.id) : undefined;
      return id === undefined ? { kind: "other" } : { kind: "button", id };
    }
    case "image": {
      const img = isRec(m.image) ? m.image : {};
      const mediaId = str(img.id);
      if (mediaId === undefined) return { kind: "other" };
      const caption = str(img.caption);
      return caption === undefined ? { kind: "image", mediaId } : { kind: "image", mediaId, caption };
    }
    case "audio": {
      const mediaId = isRec(m.audio) ? str(m.audio.id) : undefined;
      return mediaId === undefined ? { kind: "other" } : { kind: "audio", mediaId };
    }
    default:
      return { kind: "other" };
  }
}

export function parseCloudWebhook(body: unknown): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  if (!isRec(body)) return { messages, statuses };
  for (const entry of arr(body.entry)) {
    if (!isRec(entry)) continue;
    for (const change of arr(entry.changes)) {
      if (!isRec(change) || !isRec(change.value)) continue;
      for (const m of arr(change.value.messages)) {
        if (!isRec(m)) continue;
        const id = str(m.id);
        const from = str(m.from);
        if (!id || !from) continue;
        const secs = Number(m.timestamp);
        const at = new Date(Number.isFinite(secs) && secs > 0 ? secs * 1000 : Date.now()).toISOString();
        // The sender number stays as Meta sends it (digits only). The handler normalizes it.
        messages.push({ waMessageId: id, phone: from, at, content: parseContent(m) });
      }
      for (const s of arr(change.value.statuses)) {
        if (!isRec(s)) continue;
        const id = str(s.id);
        const state = str(s.status);
        if (!id || !state || !STATES.includes(state)) continue;
        const u: StatusUpdate = { waMessageId: id, state: state as StatusUpdate["state"] };
        const first = arr(s.errors)[0];
        const title = isRec(first) ? str(first.title) : undefined;
        if (title) u.error = title;
        statuses.push(u);
      }
    }
  }
  return { messages, statuses };
}

export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const hex = header.slice("sha256=".length);
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(hex, "hex");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

function toGraphMessage(phone: string, out: Out): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", to: phone };
  switch (out.type) {
    case "text":
      return { ...base, type: "text", text: { body: out.body } };
    case "buttons":
      return { ...base, type: "interactive", interactive: {
        type: "button", body: { text: out.body },
        action: { buttons: out.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
      } };
    case "list":
      return { ...base, type: "interactive", interactive: {
        type: "list", body: { text: out.body },
        action: { button: out.button, sections: [{ title: out.button, rows: out.rows.map((r) => ({ id: r.id, title: r.title })) }] },
      } };
    case "template":
      // Quick-reply buttons are defined in the Meta template, so no button components are sent.
      return { ...base, type: "template", template: {
        name: out.name, language: { code: "he" },
        components: [{ type: "body", parameters: out.params.map((text) => ({ type: "text", text })) }],
      } };
  }
}

export class CloudApiChannel implements Channel {
  private token: string;
  private phoneNumberId: string;
  private fetchFn: typeof fetch;

  constructor(cfg: { token: string; phoneNumberId: string; fetch?: typeof fetch }) {
    this.token = cfg.token;
    this.phoneNumberId = cfg.phoneNumberId;
    this.fetchFn = cfg.fetch ?? fetch;
  }

  async send(phone: string, out: Out): Promise<{ waMessageId: string | null }> {
    const res = await this.fetchFn(`${GRAPH}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGraphMessage(phone, out)),
    });
    if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status}`);
    const json: unknown = await res.json();
    const first = isRec(json) ? arr(json.messages)[0] : undefined;
    return { waMessageId: (isRec(first) ? str(first.id) : undefined) ?? null };
  }

  async fetchMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }> {
    const auth = { Authorization: `Bearer ${this.token}` };
    const meta = await this.fetchFn(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!meta.ok) throw new Error(`WhatsApp media lookup failed: ${meta.status}`);
    const info: unknown = await meta.json();
    const url = isRec(info) ? str(info.url) : undefined;
    if (!url) throw new Error("WhatsApp media lookup returned no url");
    const mime = (isRec(info) ? str(info.mime_type) : undefined) ?? "application/octet-stream";
    const file = await this.fetchFn(url, { headers: auth });
    if (!file.ok) throw new Error(`WhatsApp media download failed: ${file.status}`);
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime };
  }
}
