"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as b from "@/lib/db/buildings";
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
