import { NextResponse } from "next/server";
import { EmailNotConfigured, sendEmail } from "@/lib/email";
import { runReminders } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

/** Daily job (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("unauthorized", { status: 401 });
  try {
    const r = await runReminders(createAdminClient(), sendEmail);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof EmailNotConfigured) return NextResponse.json({ skipped: "email not configured" });
    throw e;
  }
}
