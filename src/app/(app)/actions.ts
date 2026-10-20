"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { completeRow } from "@/lib/db/complete";
import { createClient } from "@/lib/supabase/server";

export async function completeRowAction(kind: "task" | "maintenance", id: string): Promise<{ needsFrequency: boolean }> {
  const user = await requireUser();
  const r = await completeRow(await createClient(), user.profileId, kind, id);
  revalidatePath("/");
  return r;
}
