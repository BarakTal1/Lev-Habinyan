import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client for server jobs that run without a signed-in user. Never import this in a component or action that serves a user. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
