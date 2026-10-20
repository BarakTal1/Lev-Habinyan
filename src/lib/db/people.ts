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
