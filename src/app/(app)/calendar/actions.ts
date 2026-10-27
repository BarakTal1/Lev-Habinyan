"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Makes a new secret link. The old link stops working at once. */
export async function createFeedTokenAction(): Promise<void> {
  const user = await requireUser();
  const db = await createClient();
  const del = await db.from("calendar_feed_token").delete().not("id", "is", null);
  if (del.error) throw new Error(del.error.message);
  const ins = await db.from("calendar_feed_token").insert({ token: randomBytes(24).toString("hex"), created_by: user.profileId });
  if (ins.error) throw new Error(ins.error.message);
  revalidatePath("/calendar");
}

export async function revokeFeedTokenAction(): Promise<void> {
  await requireUser();
  const del = await (await createClient()).from("calendar_feed_token").delete().not("id", "is", null);
  if (del.error) throw new Error(del.error.message);
  revalidatePath("/calendar");
}
