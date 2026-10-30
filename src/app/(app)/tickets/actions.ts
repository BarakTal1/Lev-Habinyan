"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getChannel } from "@/lib/bot/channel";
import { changeStatus, previewForInfo, previewForStatus, previewForVisit, sendTicketMessage } from "@/lib/bot/send";
import type { Preview } from "@/lib/bot/templates";
import * as tickets from "@/lib/db/tickets";
import { CATEGORIES, STATUSES, URGENCIES, t } from "@/lib/labels";
import { israelLocalToIso } from "@/lib/israel";
import { createClient } from "@/lib/supabase/server";

function refresh(id?: string) {
  if (id) revalidatePath(`/tickets/${id}`);
  revalidatePath("/tickets");
  revalidatePath("/");
}

export async function createTicketAction(input: tickets.CreateTicketInput): Promise<{ id: string; number: number }> {
  const user = await requireUser();
  const title = input.title?.trim();
  if (!title) throw new Error("title required");
  if (!(CATEGORIES as readonly string[]).includes(input.category)) throw new Error("bad category");
  if (input.urgency && !(URGENCIES as readonly string[]).includes(input.urgency)) throw new Error("bad urgency");
  if (input.kind !== "fault" && input.kind !== "task") throw new Error("bad kind");
  // Only the fields the form sends. The reporter, the maintenance link and the unit id are not taken from the browser.
  const { kind, category, urgency, building_id, unit_number, assignee_id, description, due_at, original_message } = input;
  const r = await tickets.createTicket(await createClient(), user.profileId, { kind, category, urgency, building_id, unit_number, assignee_id, description, due_at, original_message, title });
  refresh();
  return r;
}

const MAX_MESSAGE = 1000;
const cleanText = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_MESSAGE) : undefined);

/** The message that goes with a status change, or null. The browser asks first, then calls setStatusAction. */
export async function previewStatusAction(id: string, status: string): Promise<Preview | null> {
  await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) throw new Error("bad status");
  return previewForStatus(await createClient(), id, status);
}

/**
 * Changes the status. With `send`, the resident gets the message too (the server builds it; the browser sends at most an edited text).
 * The status changes even when the send fails.
 */
export async function setStatusAction(id: string, status: string, send?: { text?: string }): Promise<{ delivery: "sent" | "failed" | null }> {
  const user = await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) throw new Error("bad status");
  const r = await changeStatus(await createClient(), getChannel(), user.profileId, id, status, { send: send ? { text: cleanText(send.text) } : undefined });
  refresh(id);
  return r;
}

/** The visit message, built from the saved visit time. */
export async function previewVisitAction(id: string): Promise<Preview | null> {
  await requireUser();
  return previewForVisit(await createClient(), id);
}

export async function sendVisitAction(id: string, text?: string): Promise<{ delivery: "sent" | "failed" | null }> {
  const user = await requireUser();
  const db = await createClient();
  const preview = await previewForVisit(db, id);
  if (!preview) return { delivery: null };
  const r = await sendTicketMessage(db, getChannel(), user.profileId, id, preview, cleanText(text));
  refresh(id);
  return r;
}

/** A question to the resident about the ticket. */
export async function requestInfoAction(id: string, question: string): Promise<{ delivery: "sent" | "failed" | null; error?: "question" | "contact" }> {
  const user = await requireUser();
  const q = question.trim().slice(0, MAX_MESSAGE);
  if (!q) return { delivery: null, error: "question" };
  const db = await createClient();
  const preview = await previewForInfo(db, id, q);
  if (!preview) return { delivery: null, error: "contact" };
  const r = await sendTicketMessage(db, getChannel(), user.profileId, id, preview);
  refresh(id);
  return r;
}

/** Roy decides that a report linked as a duplicate is its own fault: the link is removed and the history says so. */
export async function unlinkDuplicateAction(id: string): Promise<void> {
  const user = await requireUser();
  const db = await createClient();
  const r = await db.from("ticket").update({ duplicate_of_id: null }).eq("id", id).select("id").single();
  if (r.error) throw new Error(r.error.message);
  await tickets.addNote(db, user.profileId, id, t.msg.unlinked);
  refresh(id);
}

export async function assignAction(id: string, personId: string | null): Promise<void> {
  const user = await requireUser();
  await tickets.assign(await createClient(), user.profileId, id, personId || null);
  refresh(id);
}

export async function addNoteAction(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await tickets.addNote(await createClient(), user.profileId, id, text);
  refresh(id);
}

export async function saveOriginalMessageAction(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  await tickets.updateTicket(await createClient(), user.profileId, id, { original_message: text || null });
  refresh(id);
}

export async function saveCostAction(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = String(formData.get("cost") ?? "").trim();
  const cost = raw === "" ? null : Number(raw);
  if (cost !== null && !Number.isFinite(cost)) return;
  await tickets.updateTicket(await createClient(), user.profileId, id, { cost_amount: cost });
  refresh(id);
}

export async function uploadAttachmentAction(id: string, kind: "photo" | "invoice", formData: FormData): Promise<void> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await tickets.uploadAttachment(await createClient(), user.profileId, id, kind, file);
  refresh(id);
}

export async function updateTicketAction(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const visit = text("scheduled_at");
  await tickets.updateTicket(await createClient(), user.profileId, id, {
    title: text("title"), category: text("category"), urgency: text("urgency"), building_id: text("building_id") || null,
    due_at: text("due_at") || null, scheduled_at: visit ? israelLocalToIso(visit) : null, description: text("description") || null,
    ...(text("responsibility") ? { responsibility: text("responsibility") } : {}),
  });
  refresh(id);
}

export async function archiveTicketAction(id: string): Promise<void> {
  const user = await requireUser();
  await tickets.archiveTicket(await createClient(), user.profileId, id);
  refresh(id);
  redirect("/tickets");
}
