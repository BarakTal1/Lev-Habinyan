import { isPhone } from "@/lib/phone";
import { normalizePhone } from "./phone";

// Settings the bot reads (working hours, emergency number, on-call phones), and the parsing of the settings form. No database code here.

/** Days are 0 (Sunday) to 6 (Saturday). Times are Israel time, "HH:mm". The closing minute is not included. */
export type WorkingHours = { days: number[]; from: string; to: string };
export type BotSettings = { hours: WorkingHours | null; emergencyNumber: string | null; oncallPhones: string[] };
export type BotSettingsError = "hours" | "emergency" | "oncall";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const clock = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** True when the office is open. No hours set means always open. */
export function isWithinHours(hours: WorkingHours | null, now: Date): boolean {
  if (!hours) return true;
  const parts = clock.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = WEEKDAY[get("weekday")];
  const time = `${get("hour")}:${get("minute")}`;
  return hours.days.includes(day) && time >= hours.from && time < hours.to;
}

/** The hours for the resident, for example "ימים א׳–ה׳, 08:00–18:00". Empty when no hours are set. */
export function hoursText(hours: WorkingHours | null): string {
  if (!hours) return "";
  const days = [...hours.days].sort((a, b) => a - b);
  const run = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText = run ? `${DAY_NAMES[days[0]]}–${DAY_NAMES[days[days.length - 1]]}` : days.map((d) => DAY_NAMES[d]).join(", ");
  return `ימים ${dayText}, ${hours.from}–${hours.to}`;
}

/** Reads the settings form. Returns the settings to store, or the name of the field that is wrong. */
export function parseBotSettings(input: { days: string[]; from: string; to: string; emergency: string; oncall: string }): { ok: true; value: BotSettings } | { ok: false; error: BotSettingsError } {
  const days = [...new Set(input.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  let hours: WorkingHours | null = null;
  if (days.length > 0) {
    if (!TIME.test(input.from) || !TIME.test(input.to) || input.from >= input.to) return { ok: false, error: "hours" };
    hours = { days, from: input.from, to: input.to };
  }

  const emergency = input.emergency.trim();
  if (emergency && !/^\+?[\d\s-]{2,15}$/.test(emergency)) return { ok: false, error: "emergency" };

  const oncallPhones: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.oncall.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean)) {
    if (!isPhone(raw)) return { ok: false, error: "oncall" };
    const n = normalizePhone(raw)!;
    if (!seen.has(n)) { seen.add(n); oncallPhones.push(raw); }
  }
  return { ok: true, value: { hours, emergencyNumber: emergency || null, oncallPhones } };
}
