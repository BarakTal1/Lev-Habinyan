"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { applyImport } from "@/lib/import/apply";
import { parseControlSheet, summarizeImport, type Problem } from "@/lib/import/controlSheet";
import { createClient } from "@/lib/supabase/server";

export type Preview = { buildings: { name: string; isNew: boolean }[]; items: number; problems: Problem[] };

export async function previewImportAction(csv: string): Promise<Preview> {
  await requireUser();
  const db = await createClient();
  const { rows, problems } = parseControlSheet(csv);
  const existing = await db.from("building").select("name").is("archived_at", null);
  return { ...summarizeImport(rows, (existing.data ?? []).map((b) => b.name)), problems };
}

export async function applyImportAction(csv: string): Promise<{ buildings: number; created: number; items: number }> {
  await requireUser();
  const r = await applyImport(await createClient(), parseControlSheet(csv).rows);
  for (const p of ["/", "/buildings", "/maintenance"]) revalidatePath(p);
  return r;
}
