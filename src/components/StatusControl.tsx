"use client";
import { useState, useTransition } from "react";
import { previewStatusAction, setStatusAction } from "@/app/(app)/tickets/actions";
import { statusPreviewKind, type Preview } from "@/lib/bot/templates";
import { STATUSES, t } from "@/lib/labels";
import { Badge } from "./Badge";
import { MessagePreviewSheet } from "./MessagePreviewSheet";

const NEXT: Record<string, string> = { "חדש": "בטיפול", "הוקצה": "בטיפול", "בטיפול": "בוצע", "ממתין": "בטיפול", "בוצע": "נפתח מחדש", "נפתח מחדש": "בטיפול", "בוטל": "נפתח מחדש" };

/** The status of a ticket. A status with a message to the resident (assigned, done) opens a preview first. */
export function StatusControl({ id, status, residentName }: { id: string; status: string; residentName?: string | null }) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<{ status: string; preview: Preview } | null>(null);
  const [notice, setNotice] = useState("");

  const run = (s: string, send?: { text?: string }) => start(async () => {
    setNotice("");
    try {
      const r = await setStatusAction(id, s, send);
      if (r.delivery === "failed") setNotice(t.msg.sendFailed);
    } finally {
      setTarget(null);
    }
  });
  // Ask the server whether this status has a message for this resident. No message: change the status at once.
  const go = (s: string) => start(async () => {
    setNotice("");
    if (residentName && statusPreviewKind(s)) {
      const preview = await previewStatusAction(id, s);
      if (preview) { setTarget({ status: s, preview }); return; }
    }
    await setStatusAction(id, s);
  });
  const next = NEXT[status];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2"><span className="text-sm font-semibold text-muted">{t.tickets.status}</span><Badge list="status" value={status} /></div>
      <button type="button" disabled={pending} onClick={() => go(next)} className="press h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-50">
        {t.tickets.nextStatus}: {next}
      </button>
      <select value={status} disabled={pending} onChange={(e) => go(e.target.value)} aria-label={t.tickets.status} className="h-12 rounded-xl bg-[#F4F6FA] px-3 text-base outline-none transition-shadow duration-150 focus:ring-4 focus:ring-navy/10">
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      {notice && <p role="status" className="text-sm text-[#B3261E]">{notice}</p>}
      <MessagePreviewSheet
        open={target !== null}
        preview={target?.preview ?? null}
        residentName={residentName ?? ""}
        sendLabel={t.msg.sendAndChange}
        skipLabel={t.msg.changeOnly}
        busy={pending}
        onSend={(text) => target && run(target.status, { text })}
        onSkip={() => target && run(target.status)}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
