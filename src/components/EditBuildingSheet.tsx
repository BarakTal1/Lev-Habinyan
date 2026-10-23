"use client";
import { useState, useTransition } from "react";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { archiveBuildingAction, updateBuildingAction } from "@/app/(app)/buildings/actions";
import { t } from "@/lib/labels";

export type EditableBuilding = { id: string; name: string; city: string | null; address: string | null; notes: string | null };

export function EditBuildingSheet({ building }: { building: EditableBuilding }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function archive() {
    if (!window.confirm(t.buildings.archiveBuildingConfirm)) return;
    start(async () => {
      setError("");
      try {
        // On success the action redirects, so a result only comes back with an error.
        const r = await archiveBuildingAction(building.id);
        if (r?.error) setError(r.error === "open" ? t.buildings.archiveBlocked : t.buildings.archiveFailed);
      } catch (e) {
        // Next throws a redirect to leave the page. Anything else is a real failure.
        if (!(e instanceof Error && e.message === "NEXT_REDIRECT")) setError(t.buildings.archiveFailed);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t.buildings.edit} className="press flex h-12 w-12 flex-none items-center justify-center rounded-full text-navy"><Icon name="edit" size={22} /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.buildings.edit}>
        <form
          action={(fd) => start(async () => {
            setError("");
            try { await updateBuildingAction(building.id, fd); setOpen(false); } catch { setError(t.buildings.archiveFailed); }
          })}
          className="flex flex-col gap-3 pb-4"
        >
          <Field label={t.buildings.name}><input name="name" required defaultValue={building.name} dir="rtl" className={inputCls} /></Field>
          <Field label={t.buildings.city}><input name="city" defaultValue={building.city ?? ""} dir="rtl" className={inputCls} /></Field>
          <Field label={t.buildings.address}><input name="address" defaultValue={building.address ?? ""} dir="rtl" className={inputCls} /></Field>
          <Field label={t.buildings.notes}><textarea name="notes" defaultValue={building.notes ?? ""} dir="rtl" rows={3} className={`${inputCls} h-auto py-2`} /></Field>
          {error && <p className="text-[#B3261E]" role="alert">{error}</p>}
          <button disabled={pending} className="h-12 rounded-xl bg-navy font-semibold text-white disabled:opacity-50">{t.common.save}</button>
          <button type="button" disabled={pending} onClick={archive} className="h-12 rounded-xl border border-[#B3261E] font-semibold text-[#B3261E] disabled:opacity-50">{t.buildings.archiveBuilding}</button>
        </form>
      </Sheet>
    </>
  );
}
