"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as b from "@/lib/db/buildings";
import * as ledger from "@/lib/db/ledger";
import type { Method } from "@/lib/domain/ledger";
import { parseAmount } from "@/lib/domain/money";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export async function createBuildingAction(formData: FormData): Promise<void> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const id = await b.createBuilding(await createClient(), { name, city: String(formData.get("city") ?? "").trim() || null, address: String(formData.get("address") ?? "").trim() || null });
  revalidatePath("/buildings");
  redirect(`/buildings/${id}`);
}

export async function addResidentAction(buildingId: string, formData: FormData): Promise<void> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  if (!name || !unit) return;
  await b.addResident(await createClient(), {
    building_id: buildingId, unit_number: unit, name, phone: String(formData.get("phone") ?? "").trim(),
    relation: formData.get("relation") === "tenant" ? "tenant" : "owner", is_committee: formData.get("committee") === "on",
  });
  revalidatePath(`/buildings/${buildingId}`);
}

export async function archiveResidentAction(buildingId: string, personId: string): Promise<void> {
  await requireUser();
  await b.archiveResident(await createClient(), personId);
  revalidatePath(`/buildings/${buildingId}`);
}

export async function uploadBuildingDocumentAction(buildingId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await b.uploadBuildingDocument(await createClient(), user.profileId, buildingId, file);
  revalidatePath(`/buildings/${buildingId}`);
}

export async function updateBuildingAction(id: string, formData: FormData): Promise<void> {
  await requireUser();
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  await b.updateBuilding(await createClient(), id, { name: text("name"), city: text("city") || null, address: text("address") || null, notes: text("notes") || null });
  revalidatePath(`/buildings/${id}`);
  revalidatePath("/buildings");
}

/** Returns an error text for the screen instead of throwing, because "has open tickets" is an expected answer. */
export async function archiveBuildingAction(id: string): Promise<{ error: string | null }> {
  await requireUser();
  try {
    await b.archiveBuilding(await createClient(), id);
  } catch (e) {
    return { error: e instanceof Error && e.message === "building has open tickets" ? "open" : "failed" };
  }
  revalidatePath("/buildings");
  revalidatePath("/");
  redirect("/buildings");
}

// Ledger. Each action returns an error key from t.ledger.errors, or nothing on success.
type LedgerResult = { error?: keyof typeof t.ledger.errors };
const METHODS: Method[] = ["card", "transfer", "check", "cash", "standing_order", "other"];
const monthOf = (v: FormDataEntryValue | null) => (/^\d{4}-\d{2}$/.test(String(v ?? "")) ? `${v}-01` : null);
const dateOf = (v: FormDataEntryValue | null) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);

async function buildingUnitIds(buildingId: string): Promise<string[]> {
  const { data, error } = await (await createClient()).from("unit").select("id").eq("building_id", buildingId).is("archived_at", null);
  if (error) throw new Error(error.message);
  return data.map((u) => u.id);
}

export async function setMonthlyFeeAction(buildingId: string, formData: FormData): Promise<LedgerResult> {
  await requireUser();
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (amount === null || amount < 0) return { error: "amount" };
  const from = monthOf(formData.get("from")), to = monthOf(formData.get("to"));
  if (!from || !to || from > to) return { error: "months" };
  const unit = String(formData.get("unit") ?? "all");
  const units = unit === "all" ? await buildingUnitIds(buildingId) : [unit];
  if (units.length === 0) return { error: "units" };
  try {
    const db = await createClient();
    for (const u of units) await ledger.setMonthlyFee(db, u, amount, from, to);
  } catch { return { error: "failed" }; }
  revalidatePath(`/buildings/${buildingId}`);
  return {};
}

export async function addSpecialChargeAction(buildingId: string, formData: FormData): Promise<LedgerResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "name" };
  const dueDate = dateOf(formData.get("due"));
  if (!dueDate) return { error: "date" };
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { error: "amount" };
  const units = formData.getAll("units").map(String);
  if (units.length === 0) return { error: "units" };
  try {
    await ledger.addSpecialCharge(await createClient(), user.profileId, { buildingId, name, dueDate, lines: units.map((unitId) => ({ unitId, amount })) });
  } catch { return { error: "failed" }; }
  revalidatePath(`/buildings/${buildingId}`);
  return {};
}

export async function recordPaymentAction(buildingId: string, unitId: string, formData: FormData): Promise<LedgerResult> {
  const user = await requireUser();
  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (amount === null || amount === 0) return { error: "amount" };
  const paidAt = dateOf(formData.get("paidAt"));
  if (!paidAt) return { error: "date" };
  const monthText = String(formData.get("month") ?? "");
  const month = monthText ? monthOf(monthText) : null;
  if (monthText && !month) return { error: "months" };
  const method = String(formData.get("method") ?? "other") as Method;
  try {
    await ledger.recordPayment(await createClient(), user.profileId, {
      buildingId, unitId, amount, paidAt, month, method: METHODS.includes(method) ? method : "other", note: String(formData.get("note") ?? "").trim() || undefined,
    });
  } catch { return { error: "failed" }; }
  revalidatePath(`/buildings/${buildingId}`);
  revalidatePath("/payments");
  revalidatePath("/");
  return {};
}
