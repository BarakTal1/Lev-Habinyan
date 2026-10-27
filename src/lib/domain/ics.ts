import { israelLocalToIso } from "@/lib/israel";
import { addDays } from "@/lib/israel";
import type { CalEvent } from "./calendar";

const compact = (date: string) => date.replaceAll("-", "");
const utcStamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const startUtc = (e: CalEvent) => israelLocalToIso(`${e.date}T${e.time}`);
const endUtc = (e: CalEvent) => new Date(new Date(startUtc(e)).getTime() + 3_600_000).toISOString();

const KIND_LABEL = { visit: "ביקור", due: "יעד", maintenance: "תחזוקה", opened: "נפתחה" } as const;

/** Escapes text for an iCalendar value. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a line at 75 octets, as RFC 5545 asks. A fold never splits a multi-byte character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  const limit = (first: boolean) => (first ? 75 : 74);
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit(parts.length === 0)) {
      parts.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

const eventTitle = (e: CalEvent) => `${KIND_LABEL[e.kind]}: ${e.title}${e.building ? ` (${e.building})` : ""}`;

/** The feed holds visits, due dates and maintenance dates. The day a fault opened is not a calendar item. */
export function toIcs(events: CalEvent[], now: Date, origin: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lev HaBinyan//Calendar//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:לב הבניין", "X-WR-TIMEZONE:Asia/Jerusalem"];
  const stamp = utcStamp(now.toISOString());
  for (const e of events) {
    if (e.kind === "opened") continue;
    lines.push("BEGIN:VEVENT", `UID:${e.id}@lev-habinyan`, `DTSTAMP:${stamp}`);
    if (e.time) lines.push(`DTSTART:${utcStamp(startUtc(e))}`, `DTEND:${utcStamp(endUtc(e))}`);
    else lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`);
    lines.push(`SUMMARY:${esc(eventTitle(e))}`);
    if (e.href) lines.push(`URL:${origin}${e.href}`);
    if (e.done) lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A link that opens Google Calendar with one event ready to save. */
export function googleAddUrl(e: CalEvent, origin: string): string {
  const dates = e.time ? `${utcStamp(startUtc(e))}/${utcStamp(endUtc(e))}` : `${compact(e.date)}/${compact(addDays(e.date, 1))}`;
  const details = [e.building, e.href ? `${origin}${e.href}` : null].filter(Boolean).join("\n");
  const q = new URLSearchParams({ action: "TEMPLATE", text: eventTitle(e), dates, details, ctz: "Asia/Jerusalem" });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
