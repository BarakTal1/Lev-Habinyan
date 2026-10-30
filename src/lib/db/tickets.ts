import type { SupabaseClient } from "@supabase/supabase-js";
import { addUnit } from "@/lib/db/buildings";
import { CATEGORIES, URGENCIES } from "@/lib/labels";
import { validateUpload } from "@/lib/uploads";

export type TicketKind = "fault" | "task";

export type CreateTicketInput = {
  kind: TicketKind;
  title: string;
  category: string;
  urgency?: string;
  building_id?: string | null;
  unit_id?: string | null;
  /** A unit number typed by the founder. The unit is created when it does not exist yet. Needs building_id. */
  unit_number?: string | null;
  reporter_id?: string | null;
  assignee_id?: string | null;
  description?: string | null;
  original_message?: string | null;
  due_at?: string | null;
  maintenance_item_id?: string | null;
};

export type TicketFilters = {
  building?: string;
  kind?: TicketKind;
  status?: string;
  urgency?: string;
  assignee?: string;
  mine?: boolean;
  q?: string;
  /** Include closed tickets (done or cancelled). Closed tickets are hidden by default unless a status filter is set. */
  closed?: boolean;
};

export type TicketListRow = {
  id: string; number: number; kind: TicketKind; title: string; urgency: string; status: string; category: string;
  due_at: string | null; created_at: string; first_action_at: string | null;
  building_id: string | null; assignee_id: string | null;
  building_name: string | null; assignee_name: string | null;
};

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

const event = (db: SupabaseClient, ticketId: string, type: string, actor: string, payload: Record<string, unknown> = {}) =>
  db.from("ticket_event").insert({ ticket_id: ticketId, type, actor, payload }).then((r) => {
    if (r.error) throw new Error(r.error.message);
  });

export async function createTicket(db: SupabaseClient, profileId: string, input: CreateTicketInput): Promise<{ id: string; number: number }> {
  const { unit_number, ...rest } = input;
  const unitId = rest.unit_id ?? (unit_number?.trim() && rest.building_id ? await addUnit(db, rest.building_id, unit_number.trim()) : null);
  const row = { urgency: "חשוב", ...rest, unit_id: unitId, created_by: profileId };
  const data = must(await db.from("ticket").insert(row).select("id, number").single());
  await event(db, data.id, "created", profileId, { kind: input.kind });
  return { id: data.id, number: Number(data.number) };
}

/** `extra` is added to the status event, for example { skippedMessage: true } when a founder chose not to message the resident. */
export async function setStatus(db: SupabaseClient, profileId: string, id: string, status: string, extra: Record<string, unknown> = {}): Promise<void> {
  const cur = must(await db.from("ticket").select("status").eq("id", id).single());
  if (cur.status === status) return;
  const closed_at = status === "בוצע" ? new Date().toISOString() : null;
  must(await db.from("ticket").update({ status, closed_at }).eq("id", id).select("id").single());
  await event(db, id, "status", profileId, { from: cur.status, to: status, ...extra });
}

export async function assign(db: SupabaseClient, profileId: string, id: string, personId: string | null): Promise<void> {
  const cur = must(await db.from("ticket").select("status, assignee_id").eq("id", id).single());
  if (cur.assignee_id === personId) return;
  const patch: Record<string, unknown> = { assignee_id: personId };
  if (personId && cur.status === "חדש") patch.status = "הוקצה";
  // Conditional on what we read, so a status another founder set in between is not overwritten.
  let upd = db.from("ticket").update(patch).eq("id", id).eq("status", cur.status);
  upd = cur.assignee_id === null ? upd.is("assignee_id", null) : upd.eq("assignee_id", cur.assignee_id);
  const done = must(await upd.select("id"));
  if (done.length === 0) return assign(db, profileId, id, personId);
  await event(db, id, "assignment", profileId, { from: cur.assignee_id, to: personId });
  if (patch.status) await event(db, id, "status", profileId, { from: cur.status, to: patch.status });
}

export async function addNote(db: SupabaseClient, profileId: string, id: string, text: string): Promise<void> {
  await event(db, id, "note", profileId, { text });
}

/** Throws when an edit would break a fixed list or a date format. */
export function validatePatch(patch: TicketPatch): void {
  if ("title" in patch && !String(patch.title ?? "").trim()) throw new Error("title required");
  if (patch.urgency != null && !(URGENCIES as readonly string[]).includes(String(patch.urgency))) throw new Error("bad urgency");
  if (patch.category != null && !(CATEGORIES as readonly string[]).includes(String(patch.category))) throw new Error("bad category");
  if (patch.due_at != null && !(/^\d{4}-\d{2}-\d{2}$/.test(String(patch.due_at)) && !Number.isNaN(Date.parse(String(patch.due_at))))) throw new Error("bad due date");
  if (patch.scheduled_at != null && Number.isNaN(Date.parse(String(patch.scheduled_at)))) throw new Error("bad visit time");
}

const EDITABLE = ["title", "description", "category", "urgency", "due_at", "scheduled_at", "cost_amount", "building_id", "unit_id", "original_message"] as const;
export type TicketPatch = Partial<Record<(typeof EDITABLE)[number], string | number | null>>;

export async function updateTicket(db: SupabaseClient, profileId: string, id: string, patch: TicketPatch): Promise<void> {
  const clean: TicketPatch = {};
  for (const k of EDITABLE) if (k in patch) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) return;
  validatePatch(clean);
  must(await db.from("ticket").update(clean).eq("id", id).select("id").single());
  await event(db, id, "edit", profileId, clean);
}

/** Hides a ticket from every list. The row stays in the database. A repeat call changes nothing. */
export async function archiveTicket(db: SupabaseClient, profileId: string, id: string): Promise<void> {
  const archived_at = new Date().toISOString();
  const done = must(await db.from("ticket").update({ archived_at }).eq("id", id).is("archived_at", null).select("id"));
  if (done.length === 0) return;
  await event(db, id, "edit", profileId, { archived_at });
}

export async function uploadAttachment(db: SupabaseClient, profileId: string, ticketId: string, kind: "photo" | "invoice" | "document", file: File): Promise<void> {
  validateUpload(file);
  const ext = (file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const path = `tickets/${ticketId}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);
  const ins = await db.from("attachment").insert({ ticket_id: ticketId, kind, storage_path: path, mime_type: file.type || null, created_by: profileId });
  if (ins.error) throw new Error(ins.error.message);
  await event(db, ticketId, "photo", profileId, { kind, path });
}

export async function listTickets(db: SupabaseClient, f: TicketFilters, myPersonId: string | null): Promise<TicketListRow[]> {
  let q = db.from("ticket")
    .select("id, number, kind, title, urgency, status, category, due_at, created_at, first_action_at, building_id, assignee_id, building:building_id(name), assignee:assignee_id(name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (f.building) q = q.eq("building_id", f.building);
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.status) q = q.eq("status", f.status);
  else if (!f.closed) q = q.not("status", "in", "(בוצע,בוטל)");
  if (f.urgency) q = q.eq("urgency", f.urgency);
  if (f.assignee) q = q.eq("assignee_id", f.assignee);
  if (f.mine) q = myPersonId ? q.eq("assignee_id", myPersonId) : q.eq("assignee_id", "00000000-0000-0000-0000-000000000000");
  if (f.q) q = q.ilike("title", `%${f.q.replace(/[%_]/g, "")}%`);
  const rows = must(await q);
  return rows.map((r) => ({
    id: r.id, number: Number(r.number), kind: r.kind as TicketKind, title: r.title, urgency: r.urgency, status: r.status, category: r.category,
    due_at: r.due_at, created_at: r.created_at, first_action_at: r.first_action_at, building_id: r.building_id, assignee_id: r.assignee_id,
    building_name: (r.building as unknown as { name: string } | null)?.name ?? null,
    assignee_name: (r.assignee as unknown as { name: string } | null)?.name ?? null,
  }));
}

export type TicketDetail = TicketListRow & {
  description: string | null; original_message: string | null; scheduled_at: string | null; cost_amount: number | null; unit_id: string | null;
  events: { id: string; type: string; created_at: string; actor_name: string | null; payload: Record<string, unknown> }[];
  attachments: { id: string; kind: string; url: string | null; created_at: string }[];
};

export async function getTicket(db: SupabaseClient, id: string): Promise<TicketDetail | null> {
  const r = await db.from("ticket")
    .select("id, number, kind, title, urgency, status, category, due_at, created_at, first_action_at, building_id, assignee_id, description, original_message, scheduled_at, cost_amount, unit_id, building:building_id(name), assignee:assignee_id(name)")
    .eq("id", id).is("archived_at", null).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) return null;
  const [ev, att] = await Promise.all([
    db.from("ticket_event").select("id, type, created_at, payload, actor:actor(person:person_id(name))").eq("ticket_id", id).order("created_at", { ascending: true }),
    db.from("attachment").select("id, kind, storage_path, created_at").eq("ticket_id", id).is("archived_at", null).order("created_at"),
  ]);
  const attachments = await Promise.all((att.data ?? []).map(async (a) => {
    const s = await db.storage.from("attachments").createSignedUrl(a.storage_path, 3600);
    return { id: a.id, kind: a.kind, url: s.data?.signedUrl ?? null, created_at: a.created_at };
  }));
  const d = r.data;
  // A message event points to its message_log row; the live delivery state (sent, delivered, read, failed) comes from there.
  const logIds = (ev.data ?? []).filter((e) => e.type === "message").map((e) => (e.payload as { logId?: string }).logId).filter((x): x is string => Boolean(x));
  const logs = logIds.length ? (await db.from("message_log").select("id, delivery_state, error").in("id", logIds)).data ?? [] : [];
  const logById = new Map(logs.map((l) => [l.id, l]));
  return {
    id: d.id, number: Number(d.number), kind: d.kind as TicketKind, title: d.title, urgency: d.urgency, status: d.status, category: d.category,
    due_at: d.due_at, created_at: d.created_at, first_action_at: d.first_action_at, building_id: d.building_id, assignee_id: d.assignee_id,
    description: d.description, original_message: d.original_message, scheduled_at: d.scheduled_at, cost_amount: d.cost_amount === null ? null : Number(d.cost_amount), unit_id: d.unit_id,
    building_name: (d.building as unknown as { name: string } | null)?.name ?? null,
    assignee_name: (d.assignee as unknown as { name: string } | null)?.name ?? null,
    events: (ev.data ?? []).map((e) => ({
      id: e.id, type: e.type, created_at: e.created_at,
      payload: (() => {
        const p = e.payload as Record<string, unknown>;
        const l = typeof p.logId === "string" ? logById.get(p.logId) : undefined;
        return l ? { ...p, delivery_state: l.delivery_state, delivery_error: l.error } : p;
      })(),
      actor_name: ((e.actor as unknown as { person: { name: string } | null } | null)?.person?.name) ?? null,
    })),
    attachments,
  };
}
