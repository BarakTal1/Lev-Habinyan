import type { SupabaseClient } from "@supabase/supabase-js";

export type PersonOption = { id: string; name: string; role: string };
export type BuildingOption = { id: string; name: string };

export async function listAssignees(db: SupabaseClient): Promise<PersonOption[]> {
  const r = await db.from("person").select("id, name, role").in("role", ["founder", "employee", "supplier"]).is("archived_at", null).order("name");
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export async function listBuildings(db: SupabaseClient): Promise<BuildingOption[]> {
  const r = await db.from("building").select("id, name").is("archived_at", null).order("name");
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

export type SupplierInput = {
  id?: string; name: string; phone: string; category: string; tier: "קבוע" | "דחוף" | "חירום";
  has_sla: boolean; availability?: string | null; area?: string | null; notes?: string | null;
};

/** Creates or updates a supplier: the person and the supplier profile. No bank details and no prices. */
export async function saveSupplier(db: SupabaseClient, input: SupplierInput): Promise<string> {
  if (!["קבוע", "דחוף", "חירום"].includes(input.tier)) throw new Error("bad tier");
  if (!input.name.trim()) throw new Error("name required");
  let id: string;
  if (input.id) {
    id = input.id;
    must(await db.from("person").update({ name: input.name, phone: input.phone }).eq("id", id).select("id").single());
  } else id = must(await db.from("person").insert({ name: input.name, phone: input.phone, role: "supplier" }).select("id").single()).id;
  must(await db.from("supplier_profile").upsert({
    person_id: id, category: input.category, tier: input.tier, has_sla: input.has_sla,
    availability: input.availability ?? null, area: input.area ?? null, notes: input.notes ?? null,
  }).select("person_id").single());
  return id;
}

export type SupplierRow = { id: string; name: string; phone: string | null; category: string; tier: string; has_sla: boolean; availability: string | null; area: string | null; notes: string | null };
export type SupplierGroup = { category: string; items: SupplierRow[] };

export async function listSuppliers(db: SupabaseClient): Promise<SupplierGroup[]> {
  const rows = must(await db.from("person").select("id, name, phone, supplier_profile(category, tier, has_sla, availability, area, notes)").eq("role", "supplier").is("archived_at", null).order("name"));
  const groups = new Map<string, SupplierRow[]>();
  for (const r of rows as unknown as { id: string; name: string; phone: string | null; supplier_profile: Omit<SupplierRow, "id" | "name" | "phone"> | Omit<SupplierRow, "id" | "name" | "phone">[] | null }[]) {
    const sp = Array.isArray(r.supplier_profile) ? r.supplier_profile[0] : r.supplier_profile;
    if (!sp) continue;
    const list = groups.get(sp.category) ?? [];
    list.push({ id: r.id, name: r.name, phone: r.phone, ...sp });
    groups.set(sp.category, list);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items })).sort((a, b) => a.category.localeCompare(b.category, "he"));
}

export type EmployeeInput = { id?: string; name: string; phone: string; job_role: string; area?: string | null };
export type EmployeeRow = { id: string; name: string; phone: string | null; job_role: string; area: string | null };

export async function saveEmployee(db: SupabaseClient, input: EmployeeInput): Promise<string> {
  if (!input.name.trim()) throw new Error("name required");
  let id: string;
  if (input.id) {
    id = input.id;
    must(await db.from("person").update({ name: input.name, phone: input.phone }).eq("id", id).select("id").single());
  } else id = must(await db.from("person").insert({ name: input.name, phone: input.phone, role: "employee" }).select("id").single()).id;
  must(await db.from("employee_profile").upsert({ person_id: id, job_role: input.job_role, area: input.area ?? null }).select("person_id").single());
  return id;
}

export async function listEmployees(db: SupabaseClient): Promise<EmployeeRow[]> {
  const rows = must(await db.from("person").select("id, name, phone, employee_profile(job_role, area)").eq("role", "employee").is("archived_at", null).order("name"));
  return (rows as unknown as { id: string; name: string; phone: string | null; employee_profile: { job_role: string; area: string | null } | { job_role: string; area: string | null }[] | null }[]).map((r) => {
    const ep = Array.isArray(r.employee_profile) ? r.employee_profile[0] : r.employee_profile;
    return { id: r.id, name: r.name, phone: r.phone, job_role: ep?.job_role ?? "", area: ep?.area ?? null };
  });
}

export async function archivePerson(db: SupabaseClient, id: string): Promise<void> {
  must(await db.from("person").update({ archived_at: new Date().toISOString() }).eq("id", id).select("id").single());
}

export async function getSetting<T>(db: SupabaseClient, key: string, fallback: T): Promise<T> {
  const r = await db.from("setting").select("value").eq("key", key).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return r.data ? (r.data.value as T) : fallback;
}

export async function setSetting(db: SupabaseClient, key: string, value: unknown): Promise<void> {
  const r = await db.from("setting").upsert({ key, value });
  if (r.error) throw new Error(r.error.message);
}
