const FIELD_LABELS: Record<string, string> = {
  title: "כותרת", description: "תיאור", category: "קטגוריה", urgency: "דחיפות", due_at: "תאריך יעד", scheduled_at: "זמן ביקור",
  cost_amount: "עלות", building_id: "בניין", unit_id: "דירה", original_message: "הודעה מקורית", archived_at: "הועבר לארכיון",
};

/** The edited field names in Hebrew, for the ticket timeline. An unknown key stays as it is. */
export function describeEdit(payload: Record<string, unknown>): string {
  return Object.keys(payload).map((k) => FIELD_LABELS[k] ?? k).join(", ");
}
