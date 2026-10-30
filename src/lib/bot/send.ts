import type { SupabaseClient } from "@supabase/supabase-js";
import { setStatus } from "@/lib/db/tickets";
import { isoToIsraelLocal } from "@/lib/israel";
import type { Channel } from "./channel";
import { findPersonByPhone, lastInboundAt } from "./db";
import { sendGuarded } from "./handler";
import { normalizePhone } from "./phone";
import { buildPreview, statusPreviewKind, type Preview } from "./templates";
import type { Out } from "./types";
import { t } from "@/lib/labels";

// A founder's messages to a resident: previews of the fixed templates, a guarded send, and a status change that can carry a message.
// The server always builds the preview itself. The browser sends back at most an edited text.

export type Resident = { personId: string; name: string; phone: string; consented: boolean };
const MAX_TEXT = 1000;

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

/** The resident who reported the ticket, with a phone. Null when the ticket has no reporter or the reporter has no phone. */
export async function getResident(db: SupabaseClient, ticketId: string): Promise<Resident | null> {
  const row = must(await db.from("ticket").select("reporter:reporter_id(id, name, phone, archived_at)").eq("id", ticketId).single()) as unknown as { reporter: { id: string; name: string; phone: string | null; archived_at: string | null } | null };
  const r = row.reporter;
  const phone = normalizePhone(r?.phone);
  if (!r || r.archived_at || !phone) return null;
  const person = await findPersonByPhone(db, phone);
  return { personId: r.id, name: r.name, phone, consented: Boolean(person?.consented) };
}

async function ticketNumber(db: SupabaseClient, ticketId: string): Promise<number> {
  return Number(must(await db.from("ticket").select("number").eq("id", ticketId).single()).number);
}

/** The message that goes with a status change, or null: no template for this status, or the resident cannot be messaged. */
export async function previewForStatus(db: SupabaseClient, ticketId: string, status: string, now: Date = new Date()): Promise<Preview | null> {
  const kind = statusPreviewKind(status);
  if (!kind) return null;
  const resident = await getResident(db, ticketId);
  if (!resident?.consented) return null;
  return buildPreview(kind, { number: await ticketNumber(db, ticketId), residentName: resident.name }, await lastInboundAt(db, resident.phone), now);
}

/** The visit message, from the visit time of the ticket. The window is the visit time and the two hours after it. */
export async function previewForVisit(db: SupabaseClient, ticketId: string, now: Date = new Date()): Promise<Preview | null> {
  const row = must(await db.from("ticket").select("number, scheduled_at").eq("id", ticketId).single());
  const resident = await getResident(db, ticketId);
  if (!row.scheduled_at || !resident?.consented) return null;
  const from = isoToIsraelLocal(row.scheduled_at); // YYYY-MM-DDTHH:mm
  const to = isoToIsraelLocal(new Date(new Date(row.scheduled_at).getTime() + t.msg.visitWindowHours * 3600_000).toISOString());
  return buildPreview("visit", { number: Number(row.number), residentName: resident.name, visit: { date: `${from.slice(8, 10)}/${from.slice(5, 7)}`, from: from.slice(11, 16), to: to.slice(11, 16) } }, await lastInboundAt(db, resident.phone), now);
}

/** A question to the resident. Throws on an empty question. */
export async function previewForInfo(db: SupabaseClient, ticketId: string, question: string, now: Date = new Date()): Promise<Preview | null> {
  const resident = await getResident(db, ticketId);
  if (!resident?.consented) return null;
  return buildPreview("info", { number: await ticketNumber(db, ticketId), residentName: resident.name, question }, await lastInboundAt(db, resident.phone), now);
}

/**
 * Sends the previewed message to the resident of the ticket and writes a "message" event that points to the log row.
 * Inside the 24-hour window the message goes out as plain text, edited or not (with the yes/no buttons for "done"). That works before Meta approves a template.
 * Outside the window only the approved template can go out, and an edited text is ignored.
 */
export async function sendTicketMessage(
  db: SupabaseClient, channel: Channel, profileId: string, ticketId: string, preview: Preview, editedText?: string,
): Promise<{ delivery: "sent" | "failed" }> {
  const resident = await getResident(db, ticketId);
  const text = preview.editable ? editedText?.trim().slice(0, MAX_TEXT) || preview.text : preview.text;
  const out: Out = preview.editable
    ? preview.buttons ? { type: "buttons", body: text, buttons: preview.buttons } : { type: "text", body: text }
    : { type: "template", name: preview.template, params: preview.params };

  const r = resident ? await sendGuarded({ db, channel }, resident.phone, out, { reply: false, ticketId }) : { sent: false, logId: null };
  must(await db.from("ticket_event").insert({
    ticket_id: ticketId, type: "message", actor: profileId, payload: { text, template: preview.editable ? null : preview.template, logId: r.logId, to: "resident", ...(resident ? {} : { error: "no resident" }) },
  }).select("id"));
  return { delivery: r.sent ? "sent" : "failed" };
}

/**
 * Changes the status. With `send`, the resident gets the template message too. The status changes even when the send fails.
 * Without `send`, a status that has a message records that the founder skipped it.
 */
export async function changeStatus(
  db: SupabaseClient, channel: Channel, profileId: string, ticketId: string, status: string, opts: { send?: { text?: string } }, now: Date = new Date(),
): Promise<{ delivery: "sent" | "failed" | null }> {
  const cur = must(await db.from("ticket").select("status").eq("id", ticketId).single());
  if (cur.status === status) return { delivery: null };
  const preview = await previewForStatus(db, ticketId, status, now);
  await setStatus(db, profileId, ticketId, status, preview && !opts.send ? { skippedMessage: true } : {});
  if (opts.send && preview) return sendTicketMessage(db, channel, profileId, ticketId, preview, opts.send.text);
  return { delivery: null };
}
