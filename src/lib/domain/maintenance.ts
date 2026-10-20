import { addDays, daysBetween } from "@/lib/israel";

export type MaintState = "ok" | "soon" | "overdue" | "nodata" | "na";
export type FreqUnit = "day" | "week" | "month" | "year";

export const SOON_DAYS = 14;

export function maintenanceState(
  item: { applicable: boolean; last_done_at: string | null; next_due_at: string | null },
  today: string,
): MaintState {
  if (!item.applicable) return "na";
  if (!item.next_due_at) return "nodata";
  const days = daysBetween(today, item.next_due_at);
  if (days < 0) return "overdue";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Adds a frequency to a YYYY-MM-DD date. Months and years clamp to the last day of the target month. */
export function addFrequency(date: string, unit: FreqUnit, count: number): string {
  if (unit === "day") return addDays(date, count);
  if (unit === "week") return addDays(date, count * 7);
  const [y, m, d] = date.split("-").map(Number);
  const totalMonths = (y * 12 + (m - 1)) + (unit === "year" ? count * 12 : count);
  const year = Math.floor(totalMonths / 12);
  const month0 = totalMonths % 12;
  const day = Math.min(d, daysInMonth(year, month0));
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function completeItem(
  item: { frequency_unit: FreqUnit | null; frequency_count: number | null },
  doneAt: string,
): { last_done_at: string; next_due_at: string | null } {
  const next = item.frequency_unit && item.frequency_count ? addFrequency(doneAt, item.frequency_unit, item.frequency_count) : null;
  return { last_done_at: doneAt, next_due_at: next };
}
