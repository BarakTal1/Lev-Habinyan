// Fixed lists for the bot: fault types, places and danger words.
import type { Category } from "@/lib/labels";

export const FAULT_TYPES: { id: string; title: string; category: Category }[] = [
  { id: "lift", title: "מעלית", category: "מעלית" },
  { id: "plumbing", title: "נזילה / אינסטלציה", category: "אינסטלציה" },
  { id: "electric", title: "חשמל ותאורה", category: "חשמל" },
  { id: "gate", title: "שער / חניה", category: "דלתות ושערים" },
  { id: "cleaning", title: "ניקיון", category: "ניקיון" },
  { id: "garden", title: "גינה", category: "גינון" },
  { id: "water", title: "מים / משאבות", category: "תחזוקה כללית" },
  { id: "other", title: "אחר", category: "אחר" },
];

export const PLACES: { id: string; title: string }[] = [
  { id: "lobby", title: "לובי" },
  { id: "stairs", title: "חדר מדרגות" },
  { id: "parking", title: "חניון" },
  { id: "roof", title: "גג" },
  { id: "lift", title: "מעלית" },
  { id: "other", title: "אחר" },
];

/** A word or phrase that marks a message as dangerous. */
export const DANGER_WORDS = [
  "הצפה", "הצפות", "מציף", "גז", "אש", "שריפה", "עשן", "קצר", "ניצוצות", "התחשמלות",
  "תקוע במעלית", "תקועה במעלית", "תקועים במעלית", "תקועות במעלית",
] as const;

// A danger word counts only as a whole word, with one optional Hebrew prefix letter.
const DANGER_PATTERNS = DANGER_WORDS.map((w) => new RegExp(`(^|\\s)[ובהלמש]?${w}(\\s|$)`));

export function hasDangerWord(text: string): boolean {
  const clean = text.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!clean) return false;
  return DANGER_PATTERNS.some((re) => re.test(clean));
}
