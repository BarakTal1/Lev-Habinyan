const TZ = "Asia/Jerusalem";
const DAY_MS = 86_400_000;

/** Today's date in Israel as YYYY-MM-DD. */
export function todayIL(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** YYYY-MM-DD to DD.MM.YY. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from one date to another. Negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utc(toIso) - utc(fromIso)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(utc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The wall-clock time in Israel for an instant, as YYYY-MM-DDTHH:mm (the format of a datetime-local input). */
export function isoToIsraelLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Converts an Israel wall-clock time (YYYY-MM-DDTHH:mm) to a UTC ISO string. Handles summer and winter time. */
export function israelLocalToIso(local: string): string {
  const m = local.match(LOCAL);
  if (!m) throw new Error("bad local time");
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Start from the UTC reading, then correct by the offset Israel has at that moment (two passes cover the clock change).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const shown = isoToIsraelLocal(new Date(guess).toISOString()).match(LOCAL)!;
    const shownUtc = Date.UTC(+shown[1], +shown[2] - 1, +shown[3], +shown[4], +shown[5]);
    guess -= shownUtc - asUtc;
  }
  return new Date(guess).toISOString();
}
