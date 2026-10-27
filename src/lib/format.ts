import { daysBetween } from "@/lib/israel";

/** Label for a due date, relative to today. Late dates are flagged. */
export function dueLabel(due: string | null, today: string): { text: string; late: boolean } {
  if (!due) return { text: "", late: false };
  const d = daysBetween(today, due);
  if (d < 0) {
    const n = -d;
    return { text: n === 1 ? "יום איחור" : n === 2 ? "יומיים איחור" : `${n} ימי איחור`, late: true };
  }
  if (d === 0) return { text: "היום", late: false };
  if (d === 1) return { text: "מחר", late: false };
  return { text: `בעוד ${d} ימים`, late: false };
}

/** How long ago something was created, in Hebrew. */
export function ageLabel(createdAt: string, now: Date): string {
  const hours = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 3_600_000);
  if (hours < 1) return "לפני פחות משעה";
  if (hours === 1) return "לפני שעה";
  if (hours === 2) return "לפני שעתיים";
  if (hours < 48) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return days === 2 ? "לפני יומיים" : `לפני ${days} ימים`;
}

/** How long a fault waits for a first action. Hours below two days, days after that. */
export function waitLabel(hours: number): string {
  if (hours < 48) return `${hours} שעות ללא טיפול`;
  return `${Math.floor(hours / 24)} ימים ללא טיפול`;
}
