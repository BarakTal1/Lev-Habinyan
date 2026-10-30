"use client";
import { useTransition } from "react";
import { approveResidentAction, rejectResidentAction } from "@/app/(app)/inbox/actions";
import type { PendingResident } from "@/lib/db/inbox";
import { t } from "@/lib/labels";
import { LtrText } from "./LtrText";

/** Residents who claimed an apartment in WhatsApp. A founder approves or rejects each one. */
export function PendingResidentsCard({ residents }: { residents: PendingResident[] }) {
  const [pending, start] = useTransition();
  if (residents.length === 0) return null;
  const approve = (r: PendingResident) => {
    if (r.unitHasOtherResident && !window.confirm(t.inbox.warnOther)) return;
    start(() => approveResidentAction(r.personId, r.unitId));
  };
  const reject = (r: PendingResident) => {
    if (!window.confirm(t.inbox.rejectConfirm)) return;
    start(() => rejectResidentAction(r.personId));
  };
  return (
    <section aria-label={t.inbox.pendingTitle} className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-[16px] font-bold">{t.inbox.pendingTitle} · {residents.length}</h2>
        <p className="text-sm text-muted">{t.inbox.pendingHelp}</p>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {residents.map((r) => (
          <li key={`${r.personId}-${r.unitId}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <div dir="rtl" className="font-semibold">{r.name} · <span className="font-normal text-muted">{r.relation === "tenant" ? t.buildings.tenant : t.buildings.owner}</span></div>
              <div dir="rtl" className="text-sm text-muted">{r.buildingName} · {t.buildings.unit} <LtrText>{r.unitNumber}</LtrText>{r.phone && <> · <LtrText>{r.phone}</LtrText></>}</div>
              {r.ticketNumbers.length > 0 && <div className="text-sm text-muted">{t.inbox.ticketsOf(r.ticketNumbers.join(", "))}</div>}
              {r.unitHasOtherResident && <div role="note" className="text-sm font-medium text-[#7A4A00]">{t.inbox.warnOther}</div>}
            </div>
            <button type="button" disabled={pending} onClick={() => approve(r)} className="h-11 rounded-xl bg-navy px-5 font-semibold text-white disabled:opacity-50">{t.inbox.approve}</button>
            <button type="button" disabled={pending} onClick={() => reject(r)} className="h-11 rounded-xl border border-line bg-white px-4 font-semibold text-muted disabled:opacity-50">{t.inbox.reject}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
