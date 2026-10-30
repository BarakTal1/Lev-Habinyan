"use server";
import { requireUser } from "@/lib/auth";
import { sendDangerAlert } from "@/lib/bot/alerts";
import { SimulatorChannel } from "@/lib/bot/channel";
import { handleInbound } from "@/lib/bot/handler";
import { normalizePhone } from "@/lib/bot/phone";
import { proposeFields } from "@/lib/bot/propose";
import { FakeSms } from "@/lib/bot/sms";
import type { Inbound, Out } from "@/lib/bot/types";
import { devLoginEnabled } from "@/lib/devLogin";
import { createAdminClient } from "@/lib/supabase/admin";

// Development only: the same guard as the password sign-in. On Vercel these actions refuse.
async function guard() {
  if (!devLoginEnabled()) throw new Error("not found");
  await requireUser();
}

export type SimMessage = { id: string; direction: "in" | "out"; body: string; payload: Inbound | Out | null; at: string; state: string | null };

/** The resident writes to the bot. The bot answers through the real handler, and the answer is saved in the message log. */
export async function simulatorSendAction(formData: FormData): Promise<void> {
  await guard();
  const phone = String(formData.get("phone") ?? "");
  if (!normalizePhone(phone)) throw new Error("bad phone");
  const db = createAdminClient();
  const channel = new SimulatorChannel();
  const kind = String(formData.get("kind") ?? "text");
  let content: Inbound;
  if (kind === "button") {
    content = { kind: "button", id: String(formData.get("id") ?? "") };
  } else if (kind === "image") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("no file");
    const mediaId = `sim-${crypto.randomUUID()}`;
    channel.media.set(mediaId, { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || "image/jpeg" });
    content = { kind: "image", mediaId, caption: String(formData.get("text") ?? "").trim() || undefined };
  } else {
    content = { kind: "text", text: String(formData.get("text") ?? "") };
  }
  await handleInbound(
    { db, channel, now: () => new Date(), propose: proposeFields, alert: (ticketId) => sendDangerAlert(db, channel, new FakeSms(), ticketId) },
    { waMessageId: `sim-${crypto.randomUUID()}`, phone, at: new Date().toISOString(), content },
  );
}

/** The whole chat of one number, oldest first. It includes what the app sent, for example a status message from a founder. */
export async function simulatorLoadAction(phone: string): Promise<SimMessage[]> {
  await guard();
  const n = normalizePhone(phone);
  if (!n) return [];
  const r = await createAdminClient().from("message_log").select("id, direction, body, payload, created_at, delivery_state").eq("phone", n).order("created_at").order("id").limit(200);
  if (r.error) throw new Error(r.error.message);
  return r.data.map((m) => ({ id: m.id, direction: m.direction, body: m.body ?? "", payload: m.payload as Inbound | Out | null, at: m.created_at, state: m.delivery_state }));
}
