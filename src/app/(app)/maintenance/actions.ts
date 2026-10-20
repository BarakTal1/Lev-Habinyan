"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import * as m from "@/lib/db/maintenance";
import { createClient } from "@/lib/supabase/server";
import { todayIL } from "@/lib/israel";

function refresh(buildingId: string) {
  revalidatePath(`/maintenance/${buildingId}`);
  revalidatePath("/maintenance");
  revalidatePath("/buildings");
  revalidatePath("/");
}

export async function markDoneAction(buildingId: string, itemId: string, formData: FormData): Promise<{ needsFrequency: boolean; next_due_at: string | null }> {
  const user = await requireUser();
  const doneAt = String(formData.get("done_at") ?? "") || todayIL(new Date());
  const file = formData.get("file");
  const r = await m.markDone(await createClient(), user.profileId, itemId, {
    done_at: doneAt, note: String(formData.get("note") ?? "").trim() || undefined, file: file instanceof File ? file : undefined,
  });
  refresh(buildingId);
  return r;
}

export async function updateItemAction(buildingId: string, itemId: string, formData: FormData): Promise<void> {
  await requireUser();
  const unit = String(formData.get("frequency_unit") ?? "");
  const count = Number(formData.get("frequency_count") ?? "");
  const hasFreq = ["day", "week", "month", "year"].includes(unit) && Number.isInteger(count) && count > 0;
  await m.updateItem(await createClient(), itemId, {
    applicable: formData.get("applicable") === "on",
    frequency_unit: hasFreq ? (unit as "day" | "week" | "month" | "year") : null,
    frequency_count: hasFreq ? count : null,
    next_due_at: String(formData.get("next_due_at") ?? "") || null,
    supplier_id: String(formData.get("supplier_id") ?? "") || null,
  });
  refresh(buildingId);
}

export async function createTaskFromItemAction(buildingId: string, itemId: string): Promise<{ ticketId: string }> {
  const user = await requireUser();
  const r = await m.createTaskFromItem(await createClient(), user.profileId, itemId);
  refresh(buildingId);
  return r;
}
