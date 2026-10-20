"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { archivePerson, saveEmployee, saveSupplier, setSetting } from "@/lib/db/people";
import { TIERS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveSupplierAction(formData: FormData): Promise<void> {
  await requireUser();
  const tier = text(formData, "tier");
  if (!(TIERS as readonly string[]).includes(tier)) throw new Error("bad tier");
  await saveSupplier(await createClient(), {
    id: text(formData, "id") || undefined, name: text(formData, "name"), phone: text(formData, "phone"), category: text(formData, "category"),
    tier: tier as "קבוע" | "דחוף" | "חירום", has_sla: formData.get("has_sla") === "on",
    availability: text(formData, "availability") || null, area: text(formData, "area") || null, notes: text(formData, "notes") || null,
  });
  revalidatePath("/suppliers");
}

export async function saveEmployeeAction(formData: FormData): Promise<void> {
  await requireUser();
  await saveEmployee(await createClient(), {
    id: text(formData, "id") || undefined, name: text(formData, "name"), phone: text(formData, "phone"),
    job_role: text(formData, "job_role"), area: text(formData, "area") || null,
  });
  revalidatePath("/employees");
}

export async function archivePersonAction(path: "/suppliers" | "/employees", id: string): Promise<void> {
  await requireUser();
  await archivePerson(await createClient(), id);
  revalidatePath(path);
}

export async function setEmailRemindersAction(formData: FormData): Promise<void> {
  await requireUser();
  await setSetting(await createClient(), "email_reminders", formData.get("on") === "on");
  revalidatePath("/settings");
}
