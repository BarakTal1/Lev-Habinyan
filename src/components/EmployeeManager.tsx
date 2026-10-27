"use client";
import { useState, useTransition } from "react";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { archivePersonAction, saveEmployeeAction } from "@/app/(app)/people-actions";
import type { EmployeeRow } from "@/lib/db/people";
import { t } from "@/lib/labels";
import { telLink } from "@/lib/phone";

export function EmployeeManager({ rows }: { rows: EmployeeRow[] }) {
  const [editing, setEditing] = useState<EmployeeRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const e = editing && editing !== "new" ? editing : null;
  return (
    <>
      {rows.length === 0 && <p className="py-10 text-center text-muted">{t.people.emptyEmployees}</p>}
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3] border border-[var(--hairline)]">
        {rows.map((r) => (
          <div key={r.id} className="flex min-h-[72px] items-center gap-2 bg-white py-2 pe-3 ps-2">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#E3E8F2] text-sm font-bold text-navy">{r.name.slice(0, 2)}</div>
            <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-start">
              <div dir="rtl" className="text-base font-semibold">{r.name}</div>
              <div className="text-sm text-muted">{[r.job_role, r.area].filter(Boolean).join(" · ")}</div>
            </button>
            {telLink(r.phone) && <a href={telLink(r.phone)!} aria-label={t.people.call} className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#E3E8F2] text-navy"><Icon name="call" size={22} filled /></a>}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setEditing("new")} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-[17px] font-bold text-white"><Icon name="add" size={22} />{t.people.add}</button>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={e ? t.people.edit : t.people.add}>
        {editing && (
          <form key={e?.id ?? "new"} action={(fd) => start(async () => { await saveEmployeeAction(fd); setEditing(null); })} className="flex flex-col gap-3 pb-4">
            {e && <input type="hidden" name="id" value={e.id} />}
            <Field label={t.people.name}><input name="name" required defaultValue={e?.name} dir="rtl" className={inputCls} /></Field>
            <Field label={t.people.phone}><input name="phone" type="tel" defaultValue={e?.phone ?? ""} dir="ltr" className={inputCls} /></Field>
            <Field label={t.people.role}><input name="job_role" required defaultValue={e?.job_role} dir="rtl" className={inputCls} /></Field>
            <Field label={t.people.area}><input name="area" defaultValue={e?.area ?? ""} dir="rtl" className={inputCls} /></Field>
            <button disabled={pending} className="h-12 rounded-xl bg-navy font-semibold text-white disabled:opacity-50">{t.common.save}</button>
            {e && <button type="button" disabled={pending} onClick={() => start(async () => { await archivePersonAction("/employees", e.id); setEditing(null); })} className="h-12 rounded-xl border border-[#B3261E] font-semibold text-[#B3261E]">{t.people.archive}</button>}
          </form>
        )}
      </Sheet>
    </>
  );
}
