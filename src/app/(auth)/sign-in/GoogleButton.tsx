"use client";
import { createClient } from "@/lib/supabase/browser";
import { t } from "@/lib/labels";

export function GoogleButton() {
  return (
    <button
      type="button"
      onClick={() => createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } })}
      className="h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white"
    >
      {t.signIn.google}
    </button>
  );
}
