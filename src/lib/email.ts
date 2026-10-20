import type { Mail } from "./reminders";

export class EmailNotConfigured extends Error {}

/** Sends mail through Resend. Needs RESEND_API_KEY and EMAIL_FROM (a verified sender address). Not configured yet. */
export async function sendEmail(m: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new EmailNotConfigured("RESEND_API_KEY and EMAIL_FROM are not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: m.to, subject: m.subject, text: m.text }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status}`);
}
