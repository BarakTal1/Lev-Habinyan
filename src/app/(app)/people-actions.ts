"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { archivePerson, clearSetting, saveEmployee, saveSupplier, setSetting } from "@/lib/db/people";
import { parseBotSettings, type BotSettingsError } from "@/lib/bot/settings";
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

/** Working hours, emergency number and on-call phones. Returns the name of the wrong field, or nothing. An empty value clears the setting. */
export async function saveBotSettingsAction(formData: FormData): Promise<{ error?: BotSettingsError | "failed" }> {
  await requireUser();
  const r = parseBotSettings({
    days: formData.getAll("days").map(String), from: String(formData.get("from") ?? ""), to: String(formData.get("to") ?? ""),
    emergency: String(formData.get("emergency") ?? ""), oncall: String(formData.get("oncall") ?? ""),
  });
  if (!r.ok) return { error: r.error };
  try {
    const db = await createClient();
    const { hours, emergencyNumber, oncallPhones } = r.value;
    await (hours ? setSetting(db, "working_hours", hours) : clearSetting(db, "working_hours"));
    await (emergencyNumber ? setSetting(db, "emergency_number", emergencyNumber) : clearSetting(db, "emergency_number"));
    await (oncallPhones.length ? setSetting(db, "oncall_phones", oncallPhones) : clearSetting(db, "oncall_phones"));
  } catch {
    return { error: "failed" };
  }
  revalidatePath("/settings");
  return {};
}

export async function setEmailRemindersAction(formData: FormData): Promise<void> {
  await requireUser();
  await setSetting(await createClient(), "email_reminders", formData.get("on") === "on");
  revalidatePath("/settings");
}
