import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/lib/bot/channel";
import { isOptedOut, lastInboundAt } from "@/lib/bot/db";
import { sendGuarded } from "@/lib/bot/handler";
import { normalizePhone } from "@/lib/bot/phone";
import { isInsideWindow } from "@/lib/bot/templates";

// The founders' side of the bot: residents who claimed an apartment and wait for approval, and chats where a resident asked for a person.

const MAX_REPLY = 1000;
const CHAT_LIMIT = 200;

export type PendingResident = {
  personId: string; name: string; phone: string | null; buildingName: string; unitId: string; unitNumber: string; relation: string;
  ticketNumbers: number[]; unitHasOtherResident: boolean;
};
export type AgentChat = { phone: string; name: string | null; lastMessage: string; at: string; insideWindow: boolean };

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

type PendingRow = {
  unit_id: string; relation: string;
  person: { id: string; name: string; phone: string | null; archived_at: string | null } | null;
  unit: { id: string; number: string; archived_at: string | null; building: { name: string; archived_at: string | null } | null; others: { person_id: string; approved_at: string | null; person: { archived_at: string | null } | null }[] } | null;
};

/** Residents whose link to an apartment waits for a founder, with the tickets they opened. */
export async function listPendingResidents(db: SupabaseClient): Promise<PendingResident[]> {
  const rows = must(await db.from("unit_person")
    .select("unit_id, relation, person:person_id(id, name, phone, archived_at), unit:unit_id(id, number, archived_at, building:building_id(name, archived_at), others:unit_person(person_id, approved_at, person:person_id(archived_at)))")
    .is("approved_at", null)) as unknown as PendingRow[];
  const live = rows.filter((r) => r.person && !r.person.archived_at && r.unit && !r.unit.archived_at && r.unit.building && !r.unit.building.archived_at);
  if (live.length === 0) return [];
  const ids = live.map((r) => r.person!.id);
  const tickets = must(await db.from("ticket").select("number, reporter_id").in("reporter_id", ids).is("archived_at", null).order("number"));
  return live.map((r) => ({
    personId: r.person!.id, name: r.person!.name, phone: r.person!.phone, buildingName: r.unit!.building!.name, unitId: r.unit_id, unitNumber: r.unit!.number, relation: r.relation,
    ticketNumbers: tickets.filter((t) => t.reporter_id === r.person!.id).map((t) => Number(t.number)),
    unitHasOtherResident: r.unit!.others.some((o) => o.person_id !== r.person!.id && o.approved_at !== null && o.person && !o.person.archived_at),
  }));
}

export async function countPendingResidents(db: SupabaseClient): Promise<number> {
  return (await listPendingResidents(db)).length;
}

/** Approves the link, and clears the "not approved" flag on this resident's tickets. */
export async function approveResident(db: SupabaseClient, personId: string, unitId: string): Promise<void> {
  must(await db.from("unit_person").update({ approved_at: new Date().toISOString() }).eq("person_id", personId).eq("unit_id", unitId).select("person_id").single());
  must(await db.from("ticket").update({ resident_approved: true }).eq("reporter_id", personId).select("id"));
}

/** Rejects the resident: the person is archived, and the tickets stay, still flagged "not approved". */
export async function rejectResident(db: SupabaseClient, personId: string): Promise<void> {
  const now = new Date().toISOString();
  const links = must(await db.from("unit_person").select("unit_id").eq("person_id", personId).is("approved_at", null));
  must(await db.from("person").update({ archived_at: now }).eq("id", personId).select("id").single());
  // An apartment the stranger invented stays in the register as an empty row. Archive it when nothing else uses it.
  for (const { unit_id } of links) {
    const [people, tariffs, payments, tickets] = await Promise.all([
      db.from("unit_person").select("person_id, person:person_id!inner(archived_at)").eq("unit_id", unit_id).neq("person_id", personId).is("person.archived_at", null),
      db.from("tariff").select("unit_id").eq("unit_id", unit_id).limit(1),
      db.from("payment").select("unit_id").eq("unit_id", unit_id).limit(1),
      db.from("ticket").select("id").eq("unit_id", unit_id).limit(1),
    ]);
    if ([people, tariffs, payments, tickets].every((r) => (must(r as { data: unknown[] | null; error: { message: string } | null }) as unknown[]).length === 0)) {
      must(await db.from("unit").update({ archived_at: now }).eq("id", unit_id).is("archived_at", null).select("id"));
    }
  }
}

/** Chats where the resident asked for a person: one row for each number, newest first, with the 24-hour window state. */
export async function listAgentChats(db: SupabaseClient, now: Date): Promise<AgentChat[]> {
  const flagged = must(await db.from("message_log").select("phone").eq("direction", "in").eq("needs_agent", true).limit(CHAT_LIMIT));
  const phones = [...new Set(flagged.map((r) => r.phone as string))];
  if (phones.length === 0) return [];
  const [inbound, people] = await Promise.all([
    db.from("message_log").select("phone, body, created_at").eq("direction", "in").in("phone", phones).order("created_at", { ascending: false }).limit(CHAT_LIMIT * 5),
    db.from("person").select("name, phone_norm").in("phone_norm", phones).is("archived_at", null),
  ]);
  const latest = new Map<string, { body: string | null; created_at: string }>();
  for (const m of must(inbound)) if (!latest.has(m.phone)) latest.set(m.phone, m);
  const names = new Map(must(people).map((p) => [p.phone_norm as string, p.name as string]));
  return phones
    .map((phone) => {
      const m = latest.get(phone)!;
      return { phone, name: names.get(phone) ?? null, lastMessage: m.body ?? "", at: m.created_at, insideWindow: isInsideWindow(new Date(m.created_at), now) };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function countAgentChats(db: SupabaseClient): Promise<number> {
  return (await listAgentChats(db, new Date())).length;
}

/** A founder's answer in a chat. Only inside the 24 hours after the resident's last message, where plain text is allowed. It clears the request. */
export async function replyInChat(db: SupabaseClient, channel: Channel, phone: string, text: string, now: Date = new Date()): Promise<void> {
  const body = text.trim().slice(0, MAX_REPLY);
  if (!body) throw new Error("empty reply");
  const n = normalizePhone(phone);
  if (!n) throw new Error("bad phone");
  if (await isOptedOut(db, n)) throw new Error("this number opted out");
  if (!isInsideWindow(await lastInboundAt(db, n), now)) throw new Error("outside the 24-hour window");
  const r = await sendGuarded({ db, channel }, n, { type: "text", body }, { reply: true });
  if (!r.sent) throw new Error("send failed");
  must(await db.from("message_log").update({ needs_agent: false }).eq("phone", n).eq("needs_agent", true).select("id"));
}

export type UnalertedDanger = { id: string; number: number; title: string; buildingName: string | null };

/** Open danger tickets that no founder has touched and for which no alert message went out. Today shows them in red. */
export async function listUnalertedDanger(db: SupabaseClient): Promise<UnalertedDanger[]> {
  const rows = must(await db.from("ticket").select("id, number, title, building:building_id(name), alerts:alert(delivery_state)")
    .eq("urgency", "סכנה").is("first_action_at", null).is("archived_at", null).not("status", "in", "(בוצע,בוטל)").order("created_at")) as unknown as
    { id: string; number: number; title: string; building: { name: string } | null; alerts: { delivery_state: string }[] }[];
  return rows
    .filter((t) => !t.alerts.some((a) => a.delivery_state === "sent"))
    .map((t) => ({ id: t.id, number: Number(t.number), title: t.title, buildingName: t.building?.name ?? null }));
}
