"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Local development only: password sign-in, enabled by NEXT_PUBLIC_DEV_LOGIN=1. Google is the real sign-in. */
export async function devSignIn(formData: FormData) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "1") redirect("/sign-in");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  redirect(error ? "/sign-in?error=1" : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/** Starts the Google sign-in on the server, so the browser needs no Supabase client code. */
export async function googleSignIn() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${proto}://${host}/auth/callback` } });
  if (error || !data.url) redirect("/sign-in?error=1");
  redirect(data.url);
}
