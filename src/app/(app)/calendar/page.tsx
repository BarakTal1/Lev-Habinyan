import { headers } from "next/headers";
import { CalendarExport } from "@/components/CalendarExport";
import { CalendarView } from "@/components/CalendarView";
import { getFeedToken, loadCalendar } from "@/lib/db/calendar";
import { isMonth } from "@/lib/domain/calendar";
import { t } from "@/lib/labels";
import { todayIL } from "@/lib/israel";
import { createClient } from "@/lib/supabase/server";

async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "";
  return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const today = todayIL(new Date());
  const month = isMonth(sp.m) ? sp.m : today.slice(0, 7);
  const db = await createClient();
  const [events, token, origin] = await Promise.all([loadCalendar(db), getFeedToken(db), siteOrigin()]);
  const feedUrl = token ? `${origin}/api/calendar/${token}/feed.ics` : null;

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="px-1 pb-3 pt-2 text-[28px] leading-tight">{t.cal.title}</h1>
      <CalendarView key={month} month={month} today={today} events={events} origin={origin}>
        <CalendarExport feedUrl={feedUrl} />
      </CalendarView>
    </main>
  );
}
