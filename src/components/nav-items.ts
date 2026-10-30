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

type NavItem = { href: string; label: string; icon: string };

/** The desktop side menu, in groups. The phone bar keeps the flat NAV list. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "ראשי", items: [NAV[0], { href: "/payments", label: "גבייה", icon: "payments" }, NAV[1], { href: "/inbox", label: "הודעות מדיירים", icon: "chat" }, NAV[2]] },
  { title: "ניהול", items: [NAV[3], NAV_EXTRA[0], NAV_EXTRA[1], NAV_EXTRA[2]] },
  { title: "מערכת", items: [NAV_EXTRA[3], NAV_EXTRA[4]] },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
