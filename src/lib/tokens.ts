// Badge colors per list value. Copied from the design mockups (data.js).

export type BadgeList = "urgency" | "status" | "maint" | "tier";
export type BadgeToken = { bg: string; fg: string; icon: string; label: string };

type Raw = { bg: string; fg: string; icon: string };

const URGENCY: Record<string, Raw> = {
  "לא חשוב": { bg: "#EEF0F3", fg: "#4A5468", icon: "keyboard_arrow_down" },
  "חשוב": { bg: "#E6EEFB", fg: "#1F4FA3", icon: "drag_handle" },
  "חשוב מאוד": { bg: "#FDF0DC", fg: "#8A5300", icon: "keyboard_arrow_up" },
  "דחוף": { bg: "#FDE2D3", fg: "#A33A0B", icon: "keyboard_double_arrow_up" },
  "סכנה": { bg: "#C62828", fg: "#FFFFFF", icon: "warning" },
};
const STATUS: Record<string, Raw> = {
  "חדש": { bg: "#E6EEFB", fg: "#1F4FA3", icon: "fiber_new" },
  "הוקצה": { bg: "#EEEAFB", fg: "#5B3FA8", icon: "assignment_ind" },
  "בטיפול": { bg: "#DFF1EF", fg: "#0B6B5F", icon: "construction" },
  "ממתין": { bg: "#EEF0F3", fg: "#4A5468", icon: "hourglass_top" },
  "בוצע": { bg: "#E3F4EA", fg: "#1F7A47", icon: "check_circle" },
  "נפתח מחדש": { bg: "#FCE6E2", fg: "#A8361F", icon: "replay" },
  "בוטל": { bg: "#F1F1F1", fg: "#6B6B6B", icon: "block" },
};
const MAINT: Record<string, Raw> = {
  "תקין": { bg: "#E3F4EA", fg: "#1F7A47", icon: "check_circle" },
  "מתקרב": { bg: "#FDF0DC", fg: "#8A5300", icon: "schedule" },
  "באיחור": { bg: "#FCE4E1", fg: "#B3261E", icon: "error" },
  "אין נתונים": { bg: "#F1EFEA", fg: "#5B6478", icon: "help" },
  "לא רלוונטי": { bg: "#F7F5F0", fg: "#8A909C", icon: "remove" },
};
const TIER: Record<string, Raw> = {
  "קבוע": { bg: "#EEF0F3", fg: "#334055", icon: "event_repeat" },
  "דחוף": { bg: "#FDF0DC", fg: "#8A5300", icon: "bolt" },
  "חירום": { bg: "#FCE4E1", fg: "#B3261E", icon: "emergency" },
};
const MAPS: Record<BadgeList, Record<string, Raw>> = { urgency: URGENCY, status: STATUS, maint: MAINT, tier: TIER };
const FALLBACK: Raw = { bg: "#EEF0F3", fg: "#4A5468", icon: "help" };

export function badge(list: BadgeList, value: string): BadgeToken {
  return { ...(MAPS[list][value] ?? FALLBACK), label: value };
}
