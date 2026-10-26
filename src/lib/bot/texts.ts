// All Hebrew text the bot sends. Button titles must stay at most 20 characters.

export const privacyVersion = "v1";

export const bot = {
  // Button titles (WhatsApp limit: 20 characters).
  btn: {
    agree: "אני מסכים/ה",
    privacy: "מדיניות פרטיות",
    report: "דיווח על תקלה",
    existing: "מצב תקלה קיימת",
    agent: "נציג אנושי",
    unit: "בדירה שלי",
    common: "בשטחים משותפים",
    danger: "כן, מסוכן",
    noDanger: "לא",
    confirm: "אישור",
    fix: "תיקון",
    notListed: "הבניין שלי לא ברשימה",
    owner: "בעל/ת דירה",
    tenant: "שוכר/ת",
    committee: "ועד הבית",
  },
  consent: "שלום, זה לב הבניין 👋\nכדי לטפל בפניות אנחנו שומרים את מספר הטלפון והפרטים שלך.",
  privacyLink: "מדיניות פרטיות",
  menu: "במה נוכל לעזור?",
  whereQ: "איפה התקלה?",
  placeQ: "באיזה מקום בשטחים המשותפים?",
  placeButton: "בחירת מקום",
  typeQ: "איזה סוג תקלה?",
  typeButton: "בחירת סוג",
  dangerQ: "יש סכנה כרגע? (הצפה, גז, אש, תקוע במעלית)",
  detailsQ: "שלחו תמונה ותיאור קצר של התקלה",
  photoOnlyQ: "מה הבעיה?",
  detailsMore: "קיבלנו. אפשר להוסיף עוד תמונה או תיאור. כשתסיימו, כתבו: סיימתי.",
  summaryTitle: "סיכום:",
  summaryWhere: "מיקום",
  summaryType: "סוג",
  summaryText: "תיאור",
  summaryUnit: "דירה שלי",
  summaryCommon: "שטחים משותפים",
  summaryOk: "הכול נכון?",
  fixQ: "מה לתקן?",
  fixButton: "בחירת שדה",
  fixWhere: "מיקום",
  fixType: "סוג",
  fixText: "תיאור",
  ticketCreated: (n: number) => `קיבלנו. מספר פנייה ${n}. נעדכן אותך כאן בכל שינוי.`,
  dangerReply: (emergencyNumber: string | null) =>
    emergencyNumber
      ? `זה נשמע מסוכן. הצוות קיבל התראה עכשיו. התקשרו מיד למספר ${emergencyNumber}.`
      : "זה נשמע מסוכן. הצוות קיבל התראה עכשיו.",
  alreadyOpen: (n: number, status: string) => `יש כבר פנייה פתוחה על זה (${n}). סטטוס: ${status}.`,
  noOpenTickets: "אין לך פניות פתוחות כרגע.",
  openTicketLine: (n: number, typeLabel: string, status: string, visit: string | null) =>
    `${n} · ${typeLabel} · ${status}${visit ? ` · ביקור: ${visit}` : ""}`,
  openTicketsTitle: "הפניות הפתוחות שלך:",
  // Unknown number flow.
  unkIntro: "לא מצאנו את המספר שלך במערכת. נכיר אותך בקצרה.",
  unkBuildingQ: "באיזה בניין את/ה גר/ה?",
  unkBuildingButton: "בחירת בניין",
  unkStreetQ: "מה שם הרחוב והמספר של הבניין?",
  unkUnitQ: "מה מספר הדירה?",
  unkNameQ: "איך קוראים לך?",
  unkRelationQ: "את/ה:",
  unkThanks: (name: string, building: string, unit: string) => `תודה ${name}! רשמנו אותך ב${building}, דירה ${unit}.`,
  unkPending: "נאשר את הפרטים בקרוב.",
  unkContinue: "בינתיים, אפשר להמשיך:",
  unkBuildingNotListed: "תודה. הצוות יבדוק את הפרטים ויחזור אליך.",
  // Agent hand-off and hours.
  agentOpen: "העברנו את הבקשה לנציג. הוא יחזור אליך כאן בהקדם.",
  agentClosed: (hoursText: string) => `הצוות לא זמין כרגע. שעות הפעילות: ${hoursText}. נחזור אליך בהקדם.`,
  // Generic.
  optOut: "הסרנו אותך מהרשימה. אפשר לכתוב לנו שוב בכל זמן.",
  unsupported: "קיבלנו את ההודעה, אבל אי אפשר לטפל בסוג הזה. שלחו טקסט או תמונה.",
  useButtons: "בחרו אחת מהאפשרויות למעלה.",
  error: "משהו השתבש. נסו שוב בעוד רגע.",
} as const;
