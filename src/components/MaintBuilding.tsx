"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "./Badge";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { createTaskFromItemAction, markDoneAction, updateItemAction } from "@/app/(app)/maintenance/actions";
import type { MaintRow } from "@/lib/db/maintenance";
import type { PersonOption } from "@/lib/db/people";
import { formatDate } from "@/lib/israel";
import { MAINT_LABEL, t } from "@/lib/labels";

export function MaintBuilding({ buildingId, rows, suppliers, today }: { buildingId: string; rows: MaintRow[]; suppliers: PersonOption[]; today: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const item = rows.find((r) => r.id === openId) ?? null;
  const close = () => { setOpenId(null); setMessage(""); setTaskId(null); };

  return (
    <>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3] shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className="press-row flex min-h-[72px] items-center gap-3 bg-white py-2.5 pe-3.5 ps-3 text-start">
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold">{r.system}</div>
              <div className="text-sm text-muted">
                {r.last_done_at ? <>{t.maint.last} <span dir="ltr">{formatDate(r.last_done_at)}</span></> : "—"}
                {r.next_due_at && <> · {t.maint.next} <span dir="ltr">{formatDate(r.next_due_at)}</span></>}
              </div>
            </div>
            <Badge list="maint" value={MAINT_LABEL[r.state]} />
            <Icon name="chevron_left" size={22} />
          </button>
        ))}
      </div>

      <Sheet open={!!item} onClose={close} title={item?.system ?? ""}>
        {item && (
          <div className="flex flex-col gap-6 pb-4">
            <form
              action={(fd) => start(async () => {
                const r = await markDoneAction(buildingId, item.id, fd);
                if (r.needsFrequency) setMessage(t.maint.needsFrequency); else close();
              })}
              className="flex flex-col gap-3"
            >
              <h3 className="font-bold">{t.maint.markDone}</h3>
              <Field label={t.maint.doneDate}><input type="date" name="done_at" defaultValue={today} dir="ltr" className={inputCls} /></Field>
              <Field label={t.maint.note}><input name="note" dir="rtl" className={inputCls} /></Field>
              <Field label={t.maint.file}><input type="file" name="file" className="text-sm" /></Field>
              {message && <p className="rounded-xl bg-[#FDF0DC] p-3 text-[#7A4A00]" role="status">{message}</p>}
              <button disabled={pending} className="h-12 rounded-xl bg-navy font-semibold text-white disabled:opacity-50">{t.maint.markDone}</button>
            </form>

            <form action={(fd) => start(async () => { await updateItemAction(buildingId, item.id, fd); close(); })} className="flex flex-col gap-3 border-t border-[#EFEBE3] pt-4" key={item.id}>
              <h3 className="font-bold">{t.maint.frequency}</h3>
              <div className="flex items-center gap-2">
                <span>{t.maint.every}</span>
                <input name="frequency_count" type="number" min={1} defaultValue={item.frequency_count ?? ""} dir="ltr" className={`${inputCls} w-20`} aria-label={t.maint.frequency} />
                <select name="frequency_unit" defaultValue={item.frequency_unit ?? "month"} className={`${inputCls} flex-1`}>
                  {(["day", "week", "month", "year"] as const).map((u) => <option key={u} value={u}>{t.maint.units[u]}</option>)}
                </select>
              </div>
              <Field label={t.maint.nextDue}><input type="date" name="next_due_at" defaultValue={item.next_due_at ?? ""} dir="ltr" className={inputCls} /></Field>
              <Field label={t.maint.supplier}>
                <select name="supplier_id" defaultValue={item.supplier_id ?? ""} className={inputCls}>
                  <option value="">{t.maint.none}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <label className="flex h-12 items-center gap-2"><input type="checkbox" name="applicable" defaultChecked={item.applicable} className="h-5 w-5" />{t.maint.applicable}</label>
              <button disabled={pending} className="h-12 rounded-xl border border-navy font-semibold text-navy disabled:opacity-50">{t.maint.saveSettings}</button>
            </form>

            <div className="flex flex-col gap-2 border-t border-[#EFEBE3] pt-4">
              <button type="button" disabled={pending} onClick={() => start(async () => { const r = await createTaskFromItemAction(buildingId, item.id); setTaskId(r.ticketId); })}
                className="h-12 rounded-xl border border-navy font-semibold text-navy disabled:opacity-50">{t.maint.createTask}</button>
              {taskId && <Link href={`/tickets/${taskId}`} className="text-center text-navy underline">{t.maint.taskCreated}</Link>}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
