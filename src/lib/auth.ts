import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppUser = { profileId: string; email: string; personId: string | null; name: string };

/** The signed-in founder, or null when signed out or not on the allowlist (row-level security returns no profile row). */
export async function getUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from("profile").select("id, email, person_id, person:person_id(name)").eq("email", user.email).maybeSingle();
  if (!data) return null;
  const person = data.person as unknown as { name: string } | null;
  return { profileId: data.id, email: data.email, personId: data.person_id, name: person?.name ?? data.email };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect("/no-access");
  return user;
}
