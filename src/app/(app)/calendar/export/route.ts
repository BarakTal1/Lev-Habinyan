import { requireUser } from "@/lib/auth";
import { loadCalendar } from "@/lib/db/calendar";
import { toIcs } from "@/lib/domain/ics";
import { createClient } from "@/lib/supabase/server";

/** A file download of the same dates, for a signed-in user. */
export async function GET(request: Request) {
  await requireUser();
  const events = await loadCalendar(await createClient());
  return new Response(toIcs(events, new Date(), new URL(request.url).origin), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="lev-habinyan.ics"' },
  });
}
