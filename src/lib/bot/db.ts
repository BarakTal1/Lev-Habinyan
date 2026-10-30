import type { SupabaseClient } from "@supabase/supabase-js";
import { getSetting } from "@/lib/db/people";
import { isoToIsraelLocal } from "@/lib/israel";
import { normUnit } from "@/lib/import/sheet";
import { normalizePhone, toLocalPhone } from "./phone";
import type { WorkingHours } from "./settings";
import { privacyVersion } from "./texts";
import type { ChatState, Draft, StepContext } from "./types";

// Queries for the bot. They take a Supabase client: the webhook passes the service-role client, the tests pass the admin client.
// Every phone goes through normalizePhone, so 052-…, +972 52… and 97252… are one number.

export type { WorkingHours };
export type BotPerson = { id: string; name: string; consented: boolean; optedOut: boolean; unitId: string | null; buildingId: string | null; approved: boolean };

const CHAT_TTL_MS = 24 * 3600_000;
const OPEN_TICKETS_LIMIT = 20;

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};
const phoneOrThrow = (p: string) => {
  const n = normalizePhone(p);
  if (!n) throw new Error("bad phone");
  return n;
};

/** True when the latest consent of this number is not revoked. Works for a number that is not a person yet. */
export async function isConsented(db: SupabaseClient, phone: string): Promise<boolean> {
  const n = normalizePhone(phone);
  if (!n) return false;
  const row = must(await db.from("consent").select("revoked_at").eq("phone", n).order("granted_at", { ascending: false }).limit(1));
  return row.length > 0 && row[0].revoked_at === null;
}

type PersonRow = { id: string; name: string; opted_out_at: string | null; links: { unit_id: string; approved_at: string | null; unit: { building_id: string; archived_at: string | null } | null }[] };

/** The person who owns this number, with the apartment to use. Several apartments: the most recently approved link wins; a link that waits for approval comes last. */
export async function findPersonByPhone(db: SupabaseClient, phone: string): Promise<BotPerson | null> {
  const n = normalizePhone(phone);
  if (!n) return null;
  const people = must(await db.from("person")
    .select("id, name, opted_out_at, links:unit_person(unit_id, approved_at, unit:unit_id(building_id, archived_at))")
    .eq("phone_norm", n).is("archived_at", null)) as unknown as PersonRow[];
  if (people.length === 0) return null;
  const best = people
    .map((p) => {
      const links = p.links.filter((l) => l.unit && !l.unit.archived_at).sort((a, b) => (b.approved_at ?? "").localeCompare(a.approved_at ?? ""));
      return { p, link: links[0] ?? null };
    })
    .sort((a, b) => Number(!!b.link?.approved_at) - Number(!!a.link?.approved_at) || (b.link?.approved_at ?? "").localeCompare(a.link?.approved_at ?? ""))[0];
  return {
    id: best.p.id, name: best.p.name, optedOut: best.p.opted_out_at !== null,
    consented: best.p.opted_out_at === null && (await isConsented(db, n)),
    unitId: best.link?.unit_id ?? null, buildingId: best.link?.unit?.building_id ?? null, approved: Boolean(best.link?.approved_at),
  };
}

/** The saved step of this chat, or null when there is none or 24 hours have passed. */
export async function loadConversation(db: SupabaseClient, phone: string, now: Date): Promise<ChatState | null> {
  const row = must(await db.from("wa_conversation").select("step, context, expires_at").eq("phone", phoneOrThrow(phone)).maybeSingle());
  if (!row || (row.expires_at && new Date(row.expires_at) <= now)) return null;
  return { step: row.step, draft: row.context as Draft };
}

/** Saves the step and renews the 24-hour time-out. Null forgets the chat. */
export async function saveConversation(db: SupabaseClient, phone: string, state: ChatState | null, now: Date): Promise<void> {
  const n = phoneOrThrow(phone);
  if (state === null) {
    must(await db.from("wa_conversation").delete().eq("phone", n).select("phone"));
    return;
  }
  must(await db.from("wa_conversation").upsert({
    phone: n, step: state.step, context: state.draft, last_inbound_at: now.toISOString(), expires_at: new Date(now.getTime() + CHAT_TTL_MS).toISOString(),
  }).select("phone"));
}

/** Stores the consent. A new consent after "stop" clears the opt-out. */
export async function recordConsent(db: SupabaseClient, phone: string, personId: string | null): Promise<void> {
  const n = phoneOrThrow(phone);
  must(await db.from("consent").insert({ phone: n, person_id: personId, text_version: privacyVersion }).select("id"));
  must(await db.from("person").update({ opted_out_at: null }).eq("phone_norm", n).not("opted_out_at", "is", null).select("id"));
}

/** "stop": revokes every consent of the number and marks the people who own it. */
export async function recordOptOut(db: SupabaseClient, phone: string): Promise<void> {
  const n = phoneOrThrow(phone);
  const now = new Date().toISOString();
  must(await db.from("consent").update({ revoked_at: now }).eq("phone", n).is("revoked_at", null).select("id"));
  must(await db.from("person").update({ opted_out_at: now }).eq("phone_norm", n).select("id"));
  // A resident who said stop must not stay in the founders' queue.
  must(await db.from("message_log").update({ needs_agent: false }).eq("phone", n).eq("needs_agent", true).select("id"));
}

/** True when this number said "stop" and has not agreed again. */
export async function isOptedOut(db: SupabaseClient, phone: string): Promise<boolean> {
  const n = normalizePhone(phone);
  if (!n) return false;
  const people = must(await db.from("person").select("id").eq("phone_norm", n).not("opted_out_at", "is", null).limit(1));
  if (people.length) return true;
  const row = must(await db.from("consent").select("revoked_at").eq("phone", n).order("granted_at", { ascending: false }).limit(1));
  return row.length > 0 && row[0].revoked_at !== null;
}

/** A resident who is not in the register claims an apartment. The link waits for a founder (approved_at stays null). */
export async function registerUnknown(db: SupabaseClient, phone: string, draft: Draft): Promise<{ personId: string }> {
  if (!draft.buildingId || !draft.unitNumber || !draft.name) throw new Error("incomplete registration");
  const number = normUnit(draft.unitNumber);
  const units = must(await db.from("unit").select("id, number").eq("building_id", draft.buildingId).is("archived_at", null));
  const unitId = units.find((u) => normUnit(u.number) === number)?.id
    ?? must(await db.from("unit").insert({ building_id: draft.buildingId, number }).select("id").single()).id;
  const committee = draft.relation === "committee";
  // A retry, or a registration that stopped half way, finds the person it made before.
  const n = phoneOrThrow(phone);
  const existing = must(await db.from("person").select("id").eq("phone_norm", n).is("archived_at", null).order("created_at").limit(1));
  const personId = existing[0]?.id
    ?? must(await db.from("person").insert({ name: draft.name, phone: toLocalPhone(phone), role: committee ? "committee" : "resident" }).select("id").single()).id;
  const linked = must(await db.from("unit_person").select("unit_id").eq("person_id", personId).eq("unit_id", unitId));
  if (linked.length === 0) {
    must(await db.from("unit_person").insert({
      unit_id: unitId, person_id: personId, relation: draft.relation === "tenant" ? "tenant" : "owner", is_committee: committee, approved_at: null,
    }).select("unit_id").single());
  }
  return { personId };
}

export async function listBuildingsForBot(db: SupabaseClient): Promise<StepContext["buildings"]> {
  return must(await db.from("building").select("id, name, address").is("archived_at", null).order("name"));
}

const visitText = (iso: string | null) => {
  if (!iso) return null;
  const local = isoToIsraelLocal(iso); // YYYY-MM-DDTHH:mm
  return `${local.slice(8, 10)}/${local.slice(5, 7)} ${local.slice(11, 16)}`;
};

/** The open tickets this person reported, newest first. The label is the ticket title. */
export async function listOpenTicketsForPerson(db: SupabaseClient, personId: string): Promise<StepContext["openTickets"]> {
  const rows = must(await db.from("ticket").select("number, title, status, scheduled_at")
    .eq("reporter_id", personId).is("archived_at", null).not("status", "in", "(בוצע,בוטל)")
    .order("created_at", { ascending: false }).limit(OPEN_TICKETS_LIMIT));
  return rows.map((t) => ({ number: Number(t.number), typeLabel: t.title, status: t.status, visit: visitText(t.scheduled_at) }));
}

async function founderPhones(db: SupabaseClient): Promise<string[]> {
  const rows = must(await db.from("person").select("phone").eq("role", "founder").is("archived_at", null).not("phone", "is", null).order("created_at"));
  return rows.map((r) => r.phone as string);
}

/** Settings the bot reads. Unset hours mean "always open". */
export async function getSettings(db: SupabaseClient): Promise<{ hours: WorkingHours | null; emergencyNumber: string | null; oncallPhones: string[] }> {
  const [hours, emergencyNumber, oncallPhones] = await Promise.all([
    getSetting<WorkingHours | null>(db, "working_hours", null),
    getSetting<string | null>(db, "emergency_number", null),
    getSetting<string[] | null>(db, "oncall_phones", null),
  ]);
  // Not set: the danger alert goes to the founders. An explicit empty list means nobody.
  return { hours, emergencyNumber: emergencyNumber || null, oncallPhones: Array.isArray(oncallPhones) ? oncallPhones : await founderPhones(db) };
}

/** When this number last wrote to us. The 24-hour window runs from here. */
export async function lastInboundAt(db: SupabaseClient, phone: string): Promise<Date | null> {
  const n = normalizePhone(phone);
  if (!n) return null;
  const row = must(await db.from("message_log").select("created_at").eq("phone", n).eq("direction", "in").order("created_at", { ascending: false }).limit(1));
  return row.length ? new Date(row[0].created_at) : null;
}
