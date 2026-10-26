// WhatsApp template catalog, 24-hour window rule, and preview builder.
import type { TemplateName } from "./types";

type Button = { id: string; title: string };

export const TEMPLATES: Record<TemplateName, { body: string; buttons?: Button[] }> = {
  ticket_assigned: { body: "שלום {{1}}, פנייה {{2}} התקבלה ושויכה לטיפול. נעדכן כשיש מועד." },
  ticket_visit: { body: "פנייה {{1}}: נציג יגיע ב-{{2}} בין {{3}} ל-{{4}}." },
  ticket_done: {
    body: "פנייה {{1}} טופלה. הכול תקין?",
    buttons: [
      { id: "done_yes:{{1}}", title: "כן" },
      { id: "done_no:{{1}}", title: "לא, לפתוח מחדש" },
    ],
  },
  ticket_info: { body: "לגבי פנייה {{1}}: {{2}}" },
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

// True when the last inbound message is less than 24 hours old.
export function isInsideWindow(lastInboundAt: Date | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < WINDOW_MS;
}

export type Preview = {
  template: TemplateName;
  params: string[];
  text: string;
  editable: boolean;
  buttons?: Button[];
};

type PreviewKind = "assigned" | "visit" | "done" | "info";
type PreviewInput = {
  number: number;
  residentName: string;
  visit?: { date: string; from: string; to: string };
  question?: string;
};

const KIND_TEMPLATE: Record<PreviewKind, TemplateName> = {
  assigned: "ticket_assigned",
  visit: "ticket_visit",
  done: "ticket_done",
  info: "ticket_info",
};

function fill(s: string, params: string[]): string {
  return s.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "");
}

export function buildPreview(kind: PreviewKind, t: PreviewInput, lastInboundAt: Date | null, now: Date): Preview {
  const template = KIND_TEMPLATE[kind];
  if (!Number.isInteger(t.number) || t.number <= 0) throw new Error("buildPreview: missing or invalid field: number");
  const num = String(t.number);
  const need = (value: string | undefined, field: string): string => {
    if (!value || !value.trim()) throw new Error(`buildPreview: missing required field: ${field}`);
    return value;
  };
  let params: string[];
  switch (kind) {
    case "assigned":
      params = [need(t.residentName, "residentName"), num];
      break;
    case "visit":
      params = [num, need(t.visit?.date, "visit.date"), need(t.visit?.from, "visit.from"), need(t.visit?.to, "visit.to")];
      break;
    case "done":
      params = [num];
      break;
    case "info":
      params = [num, need(t.question?.trim(), "question")];
      break;
  }
  const def = TEMPLATES[template];
  const preview: Preview = {
    template,
    params,
    text: fill(def.body, params),
    editable: isInsideWindow(lastInboundAt, now),
  };
  if (def.buttons) preview.buttons = def.buttons.map((b) => ({ id: fill(b.id, params), title: b.title }));
  return preview;
}

// A status without a template changes with no preview.
export function statusPreviewKind(status: string): "assigned" | "done" | null {
  if (status === "הוקצה") return "assigned";
  if (status === "בוצע") return "done";
  return null;
}
