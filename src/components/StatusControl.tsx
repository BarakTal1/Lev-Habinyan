"use client";
import { useTransition } from "react";
import { setStatusAction } from "@/app/(app)/tickets/actions";
import { STATUSES, t } from "@/lib/labels";
import { Badge } from "./Badge";

const NEXT: Record<string, string> = { "חדש": "בטיפול", "הוקצה": "בטיפול", "בטיפול": "בוצע", "ממתין": "בטיפול", "בוצע": "נפתח מחדש", "נפתח מחדש": "בטיפול", "בוטל": "נפתח מחדש" };

export function StatusControl({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const go = (s: string) => start(() => setStatusAction(id, s));
  const next = NEXT[status];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2"><span className="text-sm font-semibold text-muted">{t.tickets.status}</span><Badge list="status" value={status} /></div>
      <button type="button" disabled={pending} onClick={() => go(next)} className="h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-50">
        {t.tickets.nextStatus}: {next}
      </button>
      <select value={status} disabled={pending} onChange={(e) => go(e.target.value)} aria-label={t.tickets.status} className="h-12 rounded-xl bg-[#F7F5F0] px-3 text-base">
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
    </div>
  );
}
