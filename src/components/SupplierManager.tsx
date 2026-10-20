"use client";
import { useState, useTransition } from "react";
import { Badge } from "./Badge";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { archivePersonAction, saveSupplierAction } from "@/app/(app)/people-actions";
import type { SupplierGroup, SupplierRow } from "@/lib/db/people";
import { CATEGORIES, TIERS, t } from "@/lib/labels";
import { telLink } from "@/lib/phone";

export function SupplierManager({ groups }: { groups: SupplierGroup[] }) {
  const [editing, setEditing] = useState<SupplierRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const s = editing && editing !== "new" ? editing : null;
  return (
    <>
      {groups.length === 0 && <p className="py-10 text-center text-muted">{t.people.emptySuppliers}</p>}
      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="px-1 pb-2 text-lg font-bold">{g.category}</h2>
            <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3] shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]">
              {g.items.map((r) => (
                <div key={r.id} className="flex min-h-[72px] items-center gap-2 bg-white py-2 pe-3 ps-2">
                  <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 ps-2 text-start">
                    <div dir="auto" className="text-base font-semibold">{r.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <Badge list="tier" value={r.tier} />
                      {r.has_sla && <span className="inline-flex items-center gap-0.5 font-semibold text-[#1F7A47]"><Icon name="verified" size={18} filled />SLA</span>}
                      {r.area && <span>{r.area}</span>}
                    </div>
                  </button>
                  {telLink(r.phone) && <a href={telLink(r.phone)!} aria-label={t.people.call} className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#E3E8F2] text-navy"><Icon name="call" size={22} filled /></a>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <button type="button" onClick={() => setEditing("new")} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-[17px] font-bold text-white"><Icon name="add" size={22} />{t.people.add}</button>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={s ? t.people.edit : t.people.add}>
        {editing && (
          <form key={s?.id ?? "new"} action={(fd) => start(async () => { await saveSupplierAction(fd); setEditing(null); })} className="flex flex-col gap-3 pb-4">
            {s && <input type="hidden" name="id" value={s.id} />}
            <Field label={t.people.name}><input name="name" required defaultValue={s?.name} dir="auto" className={inputCls} /></Field>
            <Field label={t.people.phone}><input name="phone" type="tel" defaultValue={s?.phone ?? ""} dir="ltr" className={inputCls} /></Field>
            <Field label={t.people.category}><select name="category" defaultValue={s?.category ?? CATEGORIES[0]} className={inputCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label={t.people.tier}><select name="tier" defaultValue={s?.tier ?? "קבוע"} className={inputCls}>{TIERS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label={t.people.availability}><input name="availability" defaultValue={s?.availability ?? ""} dir="auto" className={inputCls} /></Field>
            <Field label={t.people.area}><input name="area" defaultValue={s?.area ?? ""} dir="auto" className={inputCls} /></Field>
            <label className="flex h-12 items-center gap-2"><input type="checkbox" name="has_sla" defaultChecked={s?.has_sla} className="h-5 w-5" />{t.people.sla}</label>
            <Field label={t.people.notes}><textarea name="notes" defaultValue={s?.notes ?? ""} dir="auto" rows={2} className={`${inputCls} h-auto py-2`} /></Field>
            <button disabled={pending} className="h-12 rounded-xl bg-navy font-semibold text-white disabled:opacity-50">{t.common.save}</button>
            {s && <button type="button" disabled={pending} onClick={() => start(async () => { await archivePersonAction("/suppliers", s.id); setEditing(null); })} className="h-12 rounded-xl border border-[#B3261E] font-semibold text-[#B3261E]">{t.people.archive}</button>}
          </form>
        )}
      </Sheet>
    </>
  );
}
