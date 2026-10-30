import { NextResponse } from "next/server";
import { sendDangerAlert } from "@/lib/bot/alerts";
import { getChannel } from "@/lib/bot/channel";
import { parseCloudWebhook, verifySignature } from "@/lib/bot/cloudApi";
import { handleInbound, handleStatus, type Deps } from "@/lib/bot/handler";
import { proposeFields } from "@/lib/bot/propose";
import { smsFromEnvOrUnconfigured } from "@/lib/bot/sms";
import { createAdminClient } from "@/lib/supabase/admin";

// Media download and a few sends can take a moment. Meta retries a webhook that is not answered in time.
export const maxDuration = 30;

// Never put a phone number in a log line.
const logError = (what: string, e: unknown) => console.error(`whatsapp webhook: ${what}: ${e instanceof Error ? e.message : "unknown error"}`);

/** Meta checks the address once, when the webhook is set up. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Messages and delivery statuses from WhatsApp. The signature is always checked. Every message is handled alone, so one failure never blocks the others. */
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.error("whatsapp webhook: WHATSAPP_APP_SECRET is not set");
    return new NextResponse("not configured", { status: 503 });
  }
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    console.error("whatsapp webhook: bad signature");
    return new NextResponse("unauthorized", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const { messages, statuses } = parseCloudWebhook(body);
  const db = createAdminClient();
  const channel = getChannel();
  const sms = smsFromEnvOrUnconfigured();
  const deps: Deps = { db, channel, now: () => new Date(), propose: proposeFields, alert: (ticketId) => sendDangerAlert(db, channel, sms, ticketId) };

  for (const m of messages) {
    try { await handleInbound(deps, m); } catch (e) { logError("message failed", e); }
  }
  for (const s of statuses) {
    try { await handleStatus(db, s); } catch (e) { logError("status failed", e); }
  }
  return NextResponse.json({ ok: true });
}
