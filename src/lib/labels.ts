// All user-facing Hebrew text and the fixed lists live here.

export const STATUSES = ["חדש", "הוקצה", "בטיפול", "ממתין", "בוצע", "נפתח מחדש", "בוטל"] as const;
export const URGENCIES = ["לא חשוב", "חשוב", "חשוב מאוד", "דחוף", "סכנה"] as const;
export const CATEGORIES = [
  "חשמל", "אינסטלציה", "מעלית", "ניקיון", "גינון", "תחזוקה כללית", "הדברה",
  "דלתות ושערים", "פינוי פסולת", "כיבוי אש", "ביטוח", "אינטרנט", "אחר",
] as const;
export const SYSTEMS = [
  "ניקיון", "גינון", "בדיקת מעלית", "בדיקת כיבוי אש", "הדברה", "שעוני חשמל",
  "בדיקת אינסטלציה", "ניקוי פיר ביוב", "בדיקת גג", "משאבות", "חיטוי מאגר מים", "שער חניון",
] as const;
export const MAINT_STATES = ["תקין", "מתקרב", "באיחור", "אין נתונים", "לא רלוונטי"] as const;
export const TIERS = ["קבוע", "דחוף", "חירום"] as const;
export const KINDS = { fault: "תקלה", task: "משימה", maintenance: "תחזוקה" } as const;

export type Status = (typeof STATUSES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type System = (typeof SYSTEMS)[number];
export type Tier = (typeof TIERS)[number];

export const t = {
  appName: "לב הבניין",
  nav: { today: "היום", tickets: "כרטיסים", buildings: "בניינים", more: "עוד" },
  more: { suppliers: "ספקים", employees: "עובדים", maintenance: "יומן תחזוקה", settings: "הגדרות", import: "ייבוא ראשוני" },
  today: {
    greeting: (name: string) => `בוקר טוב, ${name}`,
    overdue: "באיחור",
    todayChip: "היום",
    open: "פתוחות",
    soon: "קרוב",
    faults: "תקלות פתוחות",
    empty: "הכל מסודר",
  },
  signIn: { title: "לב הבניין · מערכת ניהול", google: "כניסה עם Google", noAccess: "אין לך הרשאת גישה", noAccessHelp: "החשבון הזה לא ברשימת המורשים. פנו לרועי או לעומר." },
  common: { save: "שמירה", cancel: "ביטול", close: "סגירה" },
} as const;
