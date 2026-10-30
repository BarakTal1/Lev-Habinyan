"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { applyImport as applyControlSheet } from "@/lib/import/apply";
import { applyImport, previewImport, type ImportKind, type ImportPreview, type ImportSource } from "@/lib/db/ledger";
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
  const r = await applyControlSheet(await createClient(), parseControlSheet(csv).rows);
  for (const p of ["/", "/buildings", "/maintenance"]) revalidatePath(p);
  return r;
}

const KINDS: ImportKind[] = ["tariffs", "payments"];
const SOURCES: ImportSource[] = ["excel", "bllink_import"];

function checkLedgerInput(kind: ImportKind, source: ImportSource, grid: string[][]) {
  if (!KINDS.includes(kind) || !SOURCES.includes(source)) throw new Error("bad import kind or source");
  if (!Array.isArray(grid) || !grid.every((r) => Array.isArray(r) && r.every((c) => typeof c === "string"))) throw new Error("bad grid");
}

export async function previewLedgerImportAction(kind: ImportKind, buildingId: string, grid: string[][], source: ImportSource): Promise<ImportPreview> {
  await requireUser();
  checkLedgerInput(kind, source, grid);
  return previewImport(await createClient(), kind, buildingId, grid, source);
}

export async function applyLedgerImportAction(kind: ImportKind, buildingId: string, fileName: string, grid: string[][], source: ImportSource): Promise<ImportPreview> {
  const user = await requireUser();
  checkLedgerInput(kind, source, grid);
  const r = await applyImport(await createClient(), user.profileId, kind, buildingId, fileName.slice(0, 200), grid, source);
  for (const p of ["/", `/buildings/${buildingId}`, "/payments"]) revalidatePath(p);
  return r;
}
