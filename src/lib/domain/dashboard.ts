import { addDays, todayIL } from "@/lib/israel";

export type TrendInput = { created_at: string; closed_at: string | null };
export type TrendWeek = { start: string; label: string; opened: number; closed: number };

/** Sunday of the Israel week that holds the date (YYYY-MM-DD). */
function weekStart(iso: string): string {
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return addDays(iso, -day);
}

/** Faults opened and closed per week, oldest week first. Weeks start on Sunday, in Israel time. */
export function buildTrend(rows: TrendInput[], now: Date, weeks = 8): TrendWeek[] {
  const current = weekStart(todayIL(now));
  const out: TrendWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const [, m, d] = start.split("-").map(Number);
    out.push({ start, label: `${d}/${m}`, opened: 0, closed: 0 });
  }
  const index = new Map(out.map((w, i) => [w.start, i]));
  const bucket = (ts: string) => index.get(weekStart(todayIL(new Date(ts))));
  for (const r of rows) {
    const o = bucket(r.created_at);
    if (o !== undefined) out[o].opened++;
    if (r.closed_at) {
      const c = bucket(r.closed_at);
      if (c !== undefined) out[c].closed++;
    }
  }
  return out;
}

export const NO_BUILDING = "ללא בניין";

/** Open faults per building, largest first. */
export function openByBuilding(rows: { building: string | null }[], top = 6): { building: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.building ?? NO_BUILDING;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([building, count]) => ({ building, count }))
    .sort((a, b) => b.count - a.count || (a.building === NO_BUILDING ? 1 : b.building === NO_BUILDING ? -1 : 0))
    .slice(0, top);
}
