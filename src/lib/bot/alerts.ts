import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "./channel";
import { lastInboundAt, getSettings } from "./db";
import type { SmsSender } from "./sms";
import { normalizePhone } from "./phone";
import { bot } from "./texts";
import { isInsideWindow } from "./templates";

const REPEAT_AFTER_MS = 10 * 60_000;
const CLOSED = ["בוצע", "בוטל"];

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

/**
 * Tells the on-call founders about a danger ticket, by WhatsApp and SMS, and records one alert row for each channel and phone.
 * A failure in one channel never stops the other. WhatsApp reaches a founder only inside the 24-hour window (no template for alerts in version 1), so SMS is the guaranteed channel.
 */
export async function sendDangerAlert(db: SupabaseClient, channel: Channel, sms: SmsSender, ticketId: string, repeatOf?: string, now: Date = new Date()): Promise<void> {
  const ticket = must(await db.from("ticket").select("id, title, building:building_id(name)").eq("id", ticketId).single()) as unknown as { id: string; title: string; building: { name: string } | null };
  const { oncallPhones } = await getSettings(db);
  const body = bot.dangerAlert(ticket.title, ticket.building?.name ?? null, `${process.env.SITE_URL ?? ""}/tickets/${ticket.id}`);

  const attempt = async (via: "sms" | "whatsapp", to: string, run: () => Promise<void>) => {
    let state: "sent" | "failed" = "sent";
    try { await run(); } catch { state = "failed"; }
    must(await db.from("alert").insert({ ticket_id: ticketId, channel: via, to_phone: to, sent_at: now.toISOString(), delivery_state: state, repeat_of: repeatOf ?? null }).select("id"));
  };

  const phones = [...new Set(oncallPhones.map((p) => normalizePhone(p)).filter((p): p is string => p !== null))];
  await Promise.all(phones.flatMap((to) => [
    attempt("whatsapp", to, async () => {
      if (!isInsideWindow(await lastInboundAt(db, to), now)) throw new Error("outside the 24-hour window");
      await channel.send(to, { type: "text", body });
    }),
    attempt("sms", to, () => sms.send(to, body)),
  ]));
}

/** Sends the alert again, once, for a danger ticket that nobody opened in 10 minutes. */
export async function runAlertRepeats(db: SupabaseClient, channel: Channel, sms: SmsSender, now: Date): Promise<{ repeated: number }> {
  const cutoff = new Date(now.getTime() - REPEAT_AFTER_MS).toISOString();
  const firsts = must(await db.from("alert").select("id, ticket_id, ticket:ticket_id(status, first_action_at, archived_at)")
    .is("repeat_of", null).lte("sent_at", cutoff).order("sent_at")) as unknown as { id: string; ticket_id: string; ticket: { status: string; first_action_at: string | null; archived_at: string | null } | null }[];
  const candidates = new Map<string, string>(); // ticket id → its first alert
  for (const a of firsts) {
    if (!a.ticket || a.ticket.first_action_at || a.ticket.archived_at || CLOSED.includes(a.ticket.status)) continue;
    if (!candidates.has(a.ticket_id)) candidates.set(a.ticket_id, a.id);
  }
  if (candidates.size === 0) return { repeated: 0 };
  const done = new Set(must(await db.from("alert").select("ticket_id").in("ticket_id", [...candidates.keys()]).not("repeat_of", "is", null)).map((r) => r.ticket_id));
  let repeated = 0;
  for (const [ticketId, firstId] of candidates) {
    if (done.has(ticketId)) continue;
    await sendDangerAlert(db, channel, sms, ticketId, firstId, now);
    repeated++;
  }
  return { repeated };
}
