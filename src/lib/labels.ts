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
export const RESPONSIBILITIES = ["החברה", "הוועד", "בעל דירה או שוכר", "אחריות ספק", "לא ידוע"] as const;
export const MAINT_STATES = ["תקין", "מתקרב", "באיחור", "אין נתונים", "לא רלוונטי"] as const;
export const TIERS = ["קבוע", "דחוף", "חירום"] as const;
/** The ticket category that fits each maintenance system, used when a task is created from an item. */
export const SYSTEM_CATEGORY: Record<(typeof SYSTEMS)[number], (typeof CATEGORIES)[number]> = {
  "ניקיון": "ניקיון", "גינון": "גינון", "בדיקת מעלית": "מעלית", "בדיקת כיבוי אש": "כיבוי אש", "הדברה": "הדברה", "שעוני חשמל": "חשמל",
  "בדיקת אינסטלציה": "אינסטלציה", "ניקוי פיר ביוב": "אינסטלציה", "בדיקת גג": "תחזוקה כללית", "משאבות": "תחזוקה כללית",
  "חיטוי מאגר מים": "תחזוקה כללית", "שער חניון": "דלתות ושערים",
};
export const MAINT_LABEL = { ok: "תקין", soon: "מתקרב", overdue: "באיחור", nodata: "אין נתונים", na: "לא רלוונטי" } as const;
export const KINDS = { fault: "תקלה", task: "משימה", maintenance: "תחזוקה" } as const;

export type Status = (typeof STATUSES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type System = (typeof SYSTEMS)[number];
export type Responsibility = (typeof RESPONSIBILITIES)[number];
export type Tier = (typeof TIERS)[number];

export const t = {
  appName: "לב הבניין",
  nav: { today: "היום", tickets: "כרטיסים", buildings: "בניינים", more: "עוד" },
  more: { suppliers: "ספקים", employees: "עובדים", maintenance: "יומן תחזוקה", settings: "הגדרות", import: "ייבוא ראשוני" },
  cal: {
    title: "לוח שנה", today: "היום", prev: "החודש הקודם", next: "החודש הבא", noEvents: "אין אירועים ביום הזה", addGoogle: "הוספה ליומן Google",
    allBuildings: "כל הבניינים", filters: "סינון לפי סוג",
    kinds: { visit: "ביקור", due: "יעד", maintenance: "תחזוקה", opened: "נפתחה" },
    weekdays: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
    export: "ייצוא ליומן", exportTitle: "חיבור ליומן Google",
    exportIntro: "היומן של Google קורא את התאריכים מקישור סודי. כל ביקור, יעד ותאריך תחזוקה יופיעו ביומן שלכם.",
    link: "הקישור הסודי", copy: "העתקה", copied: "הועתק", create: "יצירת קישור", rotate: "קישור חדש", revoke: "ביטול הקישור",
    rotateHint: "קישור חדש מבטל את הקישור הקודם.",
    steps: ["ביומן Google פתחו את ״יומנים אחרים״ ולחצו על +", "בחרו ״מכתובת URL״", "הדביקו את הקישור ולחצו ״הוספת יומן״"],
    delay: "Google מרענן יומנים כאלה פעם ביום בערך. שינוי באפליקציה יופיע ביומן עד 24 שעות מאוחר יותר.",
    secretWarn: "מי שמחזיק בקישור רואה את הכותרות והתאריכים. אל תשתפו אותו.",
    download: "הורדת קובץ ‎.ics",
  },
  today: {
    greeting: (name: string) => `בוקר טוב, ${name}`,
    overdue: "באיחור",
    todayChip: "היום",
    open: "פתוחות",
    soon: "קרוב",
    faults: "תקלות פתוחות",
    urgentNow: "דחוף עכשיו",
    urgentHeadline: (n: number) => (n === 1 ? "תקלה דחופה אחת מחכה לטיפול" : `${n} תקלות דחופות מחכות לטיפול`),
    overdueHeadline: (n: number) => (n === 1 ? "פריט אחד באיחור" : `${n} פריטים באיחור`),
    empty: "הכל מסודר",
    stats: { open: "תקלות פתוחות", openHint: "בכל הבניינים", urgent: "דחופות עכשיו", overdue: "באיחור", soon: "ב-14 הימים הקרובים", urgentHint: "סכנה או דחוף", overdueHint: "תחזוקה, משימות ותקלות", soonHint: "תחזוקה ומשימות" },
    trendTitle: "תקלות לפי שבוע", trendSub: "8 שבועות אחרונים",
    byBuildingTitle: "תקלות פתוחות לפי בניין", noOpenFaults: "אין תקלות פתוחות",
    needsFrequency: "נשמר. הגדירו תדירות ביומן התחזוקה כדי שהתאריך הבא יחושב.", failed: "השמירה נכשלה. נסו שוב.", toCalendar: "ליומן התחזוקה",
  },
  signIn: { title: "לב הבניין · מערכת ניהול", google: "כניסה עם Google", noAccess: "אין לך הרשאת גישה", noAccessHelp: "החשבון הזה לא ברשימת המורשים. פנו לרועי או לעומר." },
  tickets: {
    title: "תקלות ומשימות", open: "פתוחות", search: "חיפוש כרטיס", all: "הכל", faults: "תקלות", tasks: "משימות", mine: "שלי", filter: "סינון", apply: "החל",
    empty: "אין כרטיסים", newTitle: "כרטיס חדש", kind: "סוג", building: "בניין", noBuilding: "ללא בניין (חברה)", titleField: "כותרת קצרה",
    category: "קטגוריה", urgency: "דחיפות", assignee: "אחראי", unassigned: "לא שויך", more: "פרטים נוספים", dueAt: "תאריך יעד", description: "תיאור",
    originalMessage: "הודעת וואטסאפ מקורית", pasteMessage: "הדביקו כאן הודעה מוואטסאפ", saveMessage: "שמירת ההודעה",
    status: "סטטוס", nextStatus: "העברה ל", notes: "הערות", addNote: "הוספת הערה", timeline: "היסטוריה", photos: "תמונות", addPhoto: "הוספת תמונה",
    cost: "עלות (₪)", invoice: "חשבונית", addInvoice: "הוספת חשבונית", saved: "נשמר", number: "מס׳",
    edit: "עריכה", archive: "העברה לארכיון", archiveConfirm: "להעביר את הכרטיס לארכיון? הוא יוסתר מכל הרשימות.", visit: "ביקור", visitTime: "מועד ביקור", closed: "סגורות", unit: "דירה (מספר)",
    ev: { created: "נוצר", status: "סטטוס", assignment: "שיוך", note: "הערה", edit: "עריכה", photo: "קובץ" },
  },
  buildings: {
    title: "בניינים", add: "הוספת בניין", name: "שם הבניין", city: "עיר", address: "כתובת", units: "דירות", openTickets: "תקלות ומשימות פתוחות",
    noDataSystems: (n: number) => (n === 1 ? "אין נתונים במערכת אחת" : `אין נתונים ב־${n} מערכות`),
    tabs: { overview: "סקירה", residents: "דיירים", suppliers: "ספקים", maintenance: "תחזוקה", documents: "מסמכים" },
    addResident: "הוספת דייר", resName: "שם", phone: "טלפון", unit: "דירה", owner: "בעלים", tenant: "שוכר", committee: "ועד", noResidents: "אין דיירים עדיין",
    noSuppliers: "אין ספקים משויכים. שייכו ספק לפריט תחזוקה.", noDocs: "אין מסמכים", addDoc: "הוספת מסמך", openMaintenance: "ליומן התחזוקה", openList: "לכרטיסים של הבניין",
    archive: "הסרה", archiveConfirm: "להסיר את", call: "חיוג", chat: "וואטסאפ", allFine: "הכל תקין",
    edit: "עריכת בניין", notes: "הערות", archiveBuilding: "העברת הבניין לארכיון", archiveBuildingConfirm: "להעביר את הבניין לארכיון? הוא יוסתר מהרשימות.",
    archiveBlocked: "אי אפשר לארכב בניין עם כרטיסים פתוחים. סגרו אותם קודם.", archiveFailed: "הפעולה נכשלה. נסו שוב.",
  },
  maint: {
    title: "יומן תחזוקה", scrollHint: "החליקו לצדדים לראות את כל המערכות", portfolio: "כל הבניינים", last: "אחרון", next: "הבא", markDone: "סימון כבוצע", doneDate: "תאריך ביצוע", note: "הערה", file: "מסמך או תמונה",
    frequency: "תדירות", every: "כל", units: { day: "ימים", week: "שבועות", month: "חודשים", year: "שנים" }, nextDue: "תאריך הבא", supplier: "ספק", applicable: "רלוונטי לבניין",
    createTask: "יצירת משימה", taskCreated: "המשימה נוצרה", needsFrequency: "נשמר. הגדירו תדירות כדי שהתאריך הבא יחושב.", saveSettings: "שמירת הגדרות", none: "ללא",
    noBuildings: "אין בניינים", legend: "מקרא",
  },
  people: {
    suppliers: "ספקים", employees: "עובדים", add: "הוספה", edit: "עריכה", name: "שם", phone: "טלפון", category: "תחום", tier: "דרג", availability: "זמינות", area: "אזור",
    sla: "יש SLA", notes: "הערות", role: "תפקיד", archive: "הסרה", emptySuppliers: "אין ספקים עדיין", emptyEmployees: "אין עובדים עדיין", call: "חיוג",
  },
  settings: {
    title: "הגדרות", founders: "המשתמשים", emailReminders: "תזכורות במייל", emailHelp: "תזכורת 14 יום לפני ובמועד היעד. השליחה תופעל כשכתובת השולח תוגדר.",
    saved: "נשמר", signOut: "יציאה",
  },
  import: {
    title: "ייבוא ראשוני", help: "העלו את גיליון הבקרה כקובץ CSV. שורה לכל בניין, עמודה לכל מערכת. נציג תצוגה מקדימה לפני השמירה.", choose: "בחירת קובץ",
    preview: "תצוגה מקדימה", newBuilding: "בניין חדש", existing: "קיים", problems: "תאים שלא הובנו (לא ייובאו)", confirm: "אישור וייבוא", done: "הייבוא הסתיים",
    result: (b: number, c: number, i: number) => `${b} בניינים (${c} חדשים), ${i} פריטי תחזוקה`, toCalendar: "ליומן התחזוקה", row: "שורה", empty: "לא נמצאו שורות בקובץ",
  },
  common: { save: "שמירה", cancel: "ביטול", close: "סגירה" },
} as const;
