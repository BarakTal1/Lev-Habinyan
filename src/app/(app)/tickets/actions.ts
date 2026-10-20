"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import * as tickets from "@/lib/db/tickets";
import { CATEGORIES, STATUSES, URGENCIES } from "@/lib/labels";
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
  const r = await tickets.createTicket(await createClient(), user.profileId, { ...input, title });
  refresh();
  return r;
}

export async function setStatusAction(id: string, status: string): Promise<void> {
  const user = await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) throw new Error("bad status");
  await tickets.setStatus(await createClient(), user.profileId, id, status);
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
  });
  refresh(id);
}
