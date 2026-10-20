"use server";
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
