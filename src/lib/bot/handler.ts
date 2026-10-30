import type { SupabaseClient } from "@supabase/supabase-js";
import { validateUpload } from "@/lib/uploads";
import { FAULT_TYPES, PLACES } from "./catalog";
import type { Channel } from "./channel";
import type { StatusUpdate } from "./cloudApi";
import {
  findPersonByPhone, getSettings, isConsented, listBuildingsForBot, listOpenTicketsForPerson, loadConversation,
  recordConsent, recordOptOut, registerUnknown, saveConversation, type BotPerson,
} from "./db";
import { nextStep } from "./flow";
import { normalizePhone } from "./phone";
import type { ProposeFn } from "./propose";
import { bot } from "./texts";
import type { Draft, Inbound, InboundMessage, Out, StepContext } from "./types";

/** Everything the handler needs from outside. The webhook passes the real ones; tests pass a simulator and a fake alert. */
export type Deps = { db: SupabaseClient; channel: Channel; now: () => Date; propose: ProposeFn; alert: (ticketId: string) => Promise<void> };

const DUPLICATE_WINDOW_MS = 7 * 24 * 3600_000;
const CLOSED = "(בוצע,בוטל)";
const DONE_REPLY = /^done_(yes|no):(\d+)$/;
const STATE_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};
// Never put a phone number in a log line.
const logError = (what: string, e: unknown) => console.error(`bot: ${what}: ${e instanceof Error ? e.message : "unknown error"}`);

const inboundBody = (c: Inbound) =>
  c.kind === "text" ? c.text.slice(0, 1000) : c.kind === "button" ? `[כפתור] ${c.id}` : c.kind === "image" ? c.caption ?? "[תמונה]" : c.kind === "audio" ? "[הקלטה]" : "[הודעה לא נתמכת]";
const outBody = (o: Out) => (o.type === "template" ? `[${o.name}] ${o.params.join(" | ")}` : o.body);

/**
 * Sends one message and logs it. A message that is not a direct reply goes only to a number with consent that has not sent "stop".
 * A refusal or a send error is logged as failed and never throws.
 */
export async function sendGuarded(
  deps: Pick<Deps, "db" | "channel">, phone: string, out: Out, opts: { reply: boolean; ticketId?: string },
): Promise<{ sent: boolean; logId: string | null }> {
  const n = normalizePhone(phone);
  if (!n) return { sent: false, logId: null };
  const base = { direction: "out" as const, phone: n, body: outBody(out).slice(0, 1000), template_name: out.type === "template" ? out.name : null, ticket_id: opts.ticketId ?? null };
  const log = async (state: "sent" | "failed", extra: { wa_message_id?: string | null; error?: string } = {}): Promise<string | null> => {
    const r = await deps.db.from("message_log").insert({ ...base, delivery_state: state, wa_message_id: extra.wa_message_id ?? null, error: extra.error ?? null }).select("id").single();
    if (r.error) { logError("message log", r.error); return null; }
    return r.data.id as string;
  };

  if (!opts.reply) {
    const person = await findPersonByPhone(deps.db, n);
    const allowed = person ? person.consented : await isConsented(deps.db, n);
    if (!allowed) {
      return { sent: false, logId: await log("failed", { error: "no consent" }) };
    }
  }
  try {
    const r = await deps.channel.send(n, out);
    return { sent: true, logId: await log("sent", { wa_message_id: r.waMessageId }) };
  } catch (e) {
    return { sent: false, logId: await log("failed", { error: (e instanceof Error ? e.message : "send failed").slice(0, 200) }) };
  }
}

/** A delivery status from WhatsApp. It only moves a message forward, so a late "delivered" never undoes "read". */
export async function handleStatus(db: SupabaseClient, s: StatusUpdate): Promise<void> {
  const row = must(await db.from("message_log").select("id, delivery_state").eq("wa_message_id", s.waMessageId).maybeSingle());
  if (!row) return;
  const current = STATE_RANK[row.delivery_state ?? "queued"] ?? 0;
  if (s.state === "failed") {
    if (current >= STATE_RANK.delivered) return;
    must(await db.from("message_log").update({ delivery_state: "failed", error: s.error ?? null }).eq("id", row.id).select("id"));
    return;
  }
  if (STATE_RANK[s.state] > current) must(await db.from("message_log").update({ delivery_state: s.state }).eq("id", row.id).select("id"));
}

/** "yes" or "no" under a ticket_done message. Returns false when the ticket is not this resident's, so the normal flow runs. */
async function answerDone(deps: Deps, phone: string, person: BotPerson, kind: "yes" | "no", number: number): Promise<boolean> {
  const { db } = deps;
  const t = must(await db.from("ticket").select("id, status").eq("number", number).eq("reporter_id", person.id).is("archived_at", null).maybeSingle());
  if (!t) return false;
  if (kind === "yes") {
    must(await db.from("ticket_event").insert({ ticket_id: t.id, type: "message", actor: null, payload: { text: "הדייר אישר", from: "resident" } }).select("id"));
    await sendGuarded(deps, phone, { type: "text", body: bot.doneThanks }, { reply: true, ticketId: t.id });
  } else {
    must(await db.from("ticket").update({ status: "נפתח מחדש", closed_at: null }).eq("id", t.id).select("id"));
    must(await db.from("ticket_event").insert({ ticket_id: t.id, type: "status", actor: null, payload: { from: t.status, to: "נפתח מחדש", by: "resident" } }).select("id"));
    await sendGuarded(deps, phone, { type: "text", body: bot.reopened }, { reply: true, ticketId: t.id });
  }
  return true;
}

const extOf = (mime: string) => (mime.split(";")[0].split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";

/** Stores one photo or voice note on the ticket. A file that cannot be fetched or is not allowed is skipped: the ticket still exists. */
async function attachMedia(deps: Deps, ticketId: string, mediaId: string, kind: "photo" | "document"): Promise<void> {
  try {
    const m = await deps.channel.fetchMedia(mediaId);
    if (kind === "photo") validateUpload({ size: m.bytes.byteLength, type: m.mime });
    else if (!m.mime.startsWith("audio/") || m.bytes.byteLength > 10 * 1024 * 1024) throw new Error("voice note not allowed");
    const path = `tickets/${ticketId}/${crypto.randomUUID()}.${extOf(m.mime)}`;
    const up = await deps.db.storage.from("attachments").upload(path, m.bytes, { contentType: m.mime });
    if (up.error) throw new Error(up.error.message);
    must(await deps.db.from("attachment").insert({ ticket_id: ticketId, kind, storage_path: path, mime_type: m.mime, created_by: null }).select("id"));
    must(await deps.db.from("ticket_event").insert({ ticket_id: ticketId, type: "photo", actor: null, payload: { kind, path } }).select("id"));
  } catch (e) {
    logError("media skipped", e);
  }
}

/** The effect "create_ticket": the ticket, its proposal, its files, the alert, and the replies to the resident. */
async function createTicketFromDraft(deps: Deps, phone: string, draft: Draft, person: BotPerson, emergencyNumber: string | null): Promise<Out[]> {
  const { db } = deps;
  if (!draft.typeId || !draft.where) throw new Error("incomplete draft");
  const type = FAULT_TYPES.find((x) => x.id === draft.typeId) ?? FAULT_TYPES.find((x) => x.id === "other")!;
  const placeTitle = PLACES.find((p) => p.id === draft.place)?.title;
  const proposed = deps.propose({ typeId: type.id, where: draft.where, placeTitle, text: draft.text });
  const urgency = draft.danger ? "סכנה" : proposed.urgency;

  // The same common-area fault, open in the last 7 days: the new report links to the first one.
  let duplicate: { id: string; number: number; status: string } | null = null;
  if (draft.where === "common" && person.buildingId) {
    const since = new Date(deps.now().getTime() - DUPLICATE_WINDOW_MS).toISOString();
    const found = must(await db.from("ticket").select("id, number, status").eq("building_id", person.buildingId).eq("category", type.category).eq("title", proposed.title)
      .is("archived_at", null).is("duplicate_of_id", null).not("status", "in", CLOSED).gte("created_at", since).order("created_at").limit(1));
    if (found.length) duplicate = { id: found[0].id, number: Number(found[0].number), status: found[0].status };
  }

  const ticket = must(await db.from("ticket").insert({
    kind: "fault", source: "whatsapp", title: proposed.title, description: proposed.description || null, category: type.category, urgency,
    responsibility: proposed.responsibility, building_id: person.buildingId, unit_id: draft.where === "unit" ? person.unitId : null,
    reporter_id: person.id, original_message: draft.text ?? null, resident_approved: person.approved, duplicate_of_id: duplicate?.id ?? null,
  }).select("id, number").single());
  must(await db.from("ticket_event").insert({ ticket_id: ticket.id, type: "created", actor: null, payload: { kind: "fault", source: "whatsapp" } }).select("id"));
  must(await db.from("proposal_log").insert({ ticket_id: ticket.id, proposed: { ...proposed, urgency, danger: Boolean(draft.danger) } }).select("id"));
  for (const id of draft.photoMediaIds) await attachMedia(deps, ticket.id, id, "photo");
  for (const id of draft.audioMediaIds) await attachMedia(deps, ticket.id, id, "document");

  if (draft.danger) await deps.alert(ticket.id).catch((e) => logError("danger alert", e));
  const out: Out[] = [{ type: "text", body: bot.ticketCreated(Number(ticket.number)) }];
  if (duplicate) out.push({ type: "text", body: bot.alreadyOpen(duplicate.number, duplicate.status) });
  if (draft.danger) out.push({ type: "text", body: bot.dangerReply(emergencyNumber) });
  return out;
}

/** One message from a resident: log it once, run the chat step, run its effects, save the state, reply. */
export async function handleInbound(deps: Deps, msg: InboundMessage): Promise<void> {
  const { db } = deps;
  const phone = normalizePhone(msg.phone);
  if (!phone) return;

  // The unique wa_message_id makes a retried webhook a no-op.
  const logged = await db.from("message_log").insert({ direction: "in", phone, wa_message_id: msg.waMessageId, body: inboundBody(msg.content), created_at: msg.at }).select("id").single();
  if (logged.error) {
    if (logged.error.code === "23505") return;
    throw new Error(logged.error.message);
  }
  const inboundId = logged.data.id as string;

  const now = deps.now();
  let person = await findPersonByPhone(db, phone);

  const done = msg.content.kind === "button" ? DONE_REPLY.exec(msg.content.id) : null;
  if (done && person && (await answerDone(deps, phone, person, done[1] as "yes" | "no", Number(done[2])))) return;

  const [state, buildings, settings] = await Promise.all([loadConversation(db, phone, now), listBuildingsForBot(db), getSettings(db)]);
  const ctx: StepContext = {
    state, now,
    resident: { known: person !== null, consented: person ? person.consented : await isConsented(db, phone), name: person?.name },
    buildings,
    openTickets: person ? await listOpenTicketsForPerson(db, person.id) : [],
    hours: { open: true, text: "" }, // Task 14 wires the working hours from the settings
    emergencyNumber: settings.emergencyNumber,
  };
  const result = nextStep(ctx, msg.content);

  const extra: Out[] = [];
  try {
    for (const e of result.effects) {
      if (e.type === "save_consent") await recordConsent(db, phone, person?.id ?? null);
      else if (e.type === "opt_out") await recordOptOut(db, phone);
      else if (e.type === "register_unknown") {
        await registerUnknown(db, phone, e.draft);
        person = await findPersonByPhone(db, phone);
      } else if (e.type === "agent_request") {
        must(await db.from("message_log").update({ needs_agent: true }).eq("id", inboundId).select("id"));
      } else if (e.type === "create_ticket") {
        if (!person) throw new Error("ticket without a resident");
        extra.push(...(await createTicketFromDraft(deps, phone, e.draft, person, settings.emergencyNumber)));
      }
    }
  } catch (e) {
    // The step is not saved, so the resident can tap again.
    logError("effect failed", e);
    await sendGuarded(deps, phone, { type: "text", body: bot.error }, { reply: true });
    return;
  }

  await saveConversation(db, phone, result.state, now);
  for (const out of [...result.out, ...extra]) await sendGuarded(deps, phone, out, { reply: true });
}
