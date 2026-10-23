"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { devLoginEnabled } from "@/lib/devLogin";
import { createClient } from "@/lib/supabase/server";

/** Local development only: password sign-in, enabled by NEXT_PUBLIC_DEV_LOGIN=1. Google is the real sign-in. */
export async function devSignIn(formData: FormData) {
  if (!devLoginEnabled()) redirect("/sign-in");
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

/** SITE_URL is the fixed production address. The forwarded headers are only a fallback for local development. */
async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host");
  return `${host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https"}://${host}`;
}

/** Starts the Google sign-in on the server, so the browser needs no Supabase client code. */
export async function googleSignIn() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${await siteUrl()}/auth/callback` } });
  if (error || !data.url) redirect("/sign-in?error=1");
  redirect(data.url);
}
