import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Local Supabase demo keys (the same for every local stack). Never use against a hosted project.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE = process.env.TEST_SUPABASE_SERVICE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

if (!URL.includes("127.0.0.1") && !URL.includes("localhost")) throw new Error("DB tests run only against the local stack");

/** A client signed in as the local dev founder, so row-level security applies as in the app. */
export async function founderClient(): Promise<{ db: SupabaseClient; profileId: string }> {
  const db = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email: "dev@lev.local", password: "dev-password-local" });
  if (error) throw error;
  const { data } = await db.from("profile").select("id").eq("email", "dev@lev.local").single();
  return { db, profileId: data!.id };
}

/** Service-role client for test setup and cleanup (bypasses row-level security). */
export function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}
