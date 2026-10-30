"use client";
import { useRef, useState, useTransition } from "react";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { updatePersonAction, updateUnitAction } from "@/app/(app)/buildings/actions";
import { t } from "@/lib/labels";

const T = t.tenants;
type Result = { error?: keyof typeof T.errors };

/** A small edit button that opens a sheet with a form. The save button submits the form and closes the sheet on success. */
function EditSheet({ label, title, run, children }: { label: string; title: string; run: (fd: FormData) => Promise<Result>; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const save = () => form.current && start(async () => {
    setError("");
    try {
      const r = await run(new FormData(form.current!));
      if (r.error) setError(T.errors[r.error]);
      else setOpen(false);
    } catch {
      setError(T.errors.failed);
    }
  });
  return (
    <>
      <button type="button" aria-label={label} onClick={() => setOpen(true)} className="press flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-[#F4F6FA]">
        <Icon name="edit" size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}
        footer={<button type="button" disabled={pending} onClick={save} className="h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-40">{t.common.save}</button>}>
        <form ref={form} onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
          {children}
          {error && <p role="alert" className="text-[#B3261E]">{error}</p>}
        </form>
      </Sheet>
    </>
  );
}

export function UnitEditSheet({ buildingId, unit, people }: {
  buildingId: string;
  unit: { id: string; number: string; floor: string | null; payer: "owner" | "tenant" | null; primary_contact_id: string | null };
  people: { person_id: string; name: string }[];
}) {
  return (
    <EditSheet label={T.editUnit(unit.number)} title={T.editUnit(unit.number)} run={(fd) => updateUnitAction(buildingId, unit.id, fd)}>
      <Field label={T.floor}><input name="floor" dir="ltr" defaultValue={unit.floor ?? ""} className={inputCls} /></Field>
      <Field label={T.payer}>
        <select name="payer" defaultValue={unit.payer ?? ""} className={inputCls}>
          <option value="">{T.none}</option>
          <option value="owner">{T.roles.owner}</option>
          <option value="tenant">{T.roles.tenant}</option>
        </select>
      </Field>
      <Field label={T.primary}>
        <select name="primary" defaultValue={unit.primary_contact_id ?? ""} className={inputCls}>
          <option value="">{T.none}</option>
          {people.map((p) => <option key={p.person_id} value={p.person_id}>{p.name}</option>)}
        </select>
      </Field>
    </EditSheet>
  );
}

export function PersonEditSheet({ buildingId, person }: { buildingId: string; person: { person_id: string; name: string; phone: string | null; email: string | null } }) {
  return (
    <EditSheet label={T.editPerson(person.name)} title={T.editPerson(person.name)} run={(fd) => updatePersonAction(buildingId, person.person_id, fd)}>
      <Field label={t.buildings.resName}><input name="name" dir="rtl" required defaultValue={person.name} className={inputCls} /></Field>
      <Field label={t.buildings.phone}><input name="phone" type="tel" dir="ltr" defaultValue={person.phone ?? ""} className={inputCls} /></Field>
      <Field label={T.email}><input name="email" type="email" dir="ltr" defaultValue={person.email ?? ""} className={inputCls} /></Field>
    </EditSheet>
  );
}
