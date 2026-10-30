import { NextResponse } from "next/server";
import { runAlertRepeats } from "@/lib/bot/alerts";
import { getChannel } from "@/lib/bot/channel";
import { smsFromEnvOrUnconfigured } from "@/lib/bot/sms";
import { createAdminClient } from "@/lib/supabase/admin";

// Repeats the danger alert for a ticket that nobody opened in 10 minutes.
// It needs a schedule of every 5 minutes. Vercel Hobby allows a daily cron only, so the schedule is not in vercel.json yet.
// On Vercel Pro add this to the crons in vercel.json: path /api/cron/alerts, schedule "*/5 * * * *".
// Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("unauthorized", { status: 401 });
  const r = await runAlertRepeats(createAdminClient(), getChannel(), smsFromEnvOrUnconfigured(), new Date());
  return NextResponse.json(r);
}
