export const NAV = [
  { href: "/", label: "היום", icon: "today" },
  { href: "/tickets", label: "כרטיסים", icon: "confirmation_number" },
  { href: "/calendar", label: "לוח שנה", icon: "calendar_month" },
  { href: "/buildings", label: "בניינים", icon: "apartment" },
  { href: "/more", label: "עוד", icon: "more_horiz" },
] as const;

export const NAV_EXTRA = [
  { href: "/maintenance", label: "יומן תחזוקה", icon: "event_repeat" },
  { href: "/suppliers", label: "ספקים", icon: "engineering" },
  { href: "/employees", label: "עובדים", icon: "groups" },
  { href: "/import", label: "ייבוא ראשוני", icon: "upload_file" },
  { href: "/settings", label: "הגדרות", icon: "settings" },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
