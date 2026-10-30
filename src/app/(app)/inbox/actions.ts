"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getChannel } from "@/lib/bot/channel";
import * as inbox from "@/lib/db/inbox";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  for (const p of ["/", "/inbox", "/tickets", "/buildings"]) revalidatePath(p);
}

export async function approveResidentAction(personId: string, unitId: string): Promise<void> {
  await requireUser();
  await inbox.approveResident(await createClient(), personId, unitId);
  refresh();
}

export async function rejectResidentAction(personId: string): Promise<void> {
  await requireUser();
  await inbox.rejectResident(await createClient(), personId);
  refresh();
}

/** A founder's answer to a resident who asked for a person. */
export async function replyInChatAction(phone: string, text: string): Promise<{ error?: "window" | "failed" }> {
  await requireUser();
  try {
    await inbox.replyInChat(await createClient(), getChannel(), phone, text);
  } catch (e) {
    return { error: e instanceof Error && /window/.test(e.message) ? "window" : "failed" };
  }
  refresh();
  return {};
}
