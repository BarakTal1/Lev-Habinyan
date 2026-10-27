import { createClient } from "@supabase/supabase-js";
import { loadFeed } from "@/lib/db/calendar";
import { toIcs } from "@/lib/domain/ics";

/** The secret feed for Google Calendar. Anyone with the link can read it, so the link is a random token that founders can revoke. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) return new Response("not found", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const events = await loadFeed(db, token);
  if (!events) return new Response("not found", { status: 404 });
  return new Response(toIcs(events, new Date(), new URL(request.url).origin), {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" },
  });
}
