"use client";
import { useState, useTransition } from "react";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { previewVisitAction, sendVisitAction, updateTicketAction } from "@/app/(app)/tickets/actions";
import type { Preview } from "@/lib/bot/templates";
import { MessagePreviewSheet } from "./MessagePreviewSheet";
import type { BuildingOption } from "@/lib/db/people";
import { CATEGORIES, URGENCIES, t } from "@/lib/labels";

export type EditableTicket = {
  id: string; title: string; category: string; urgency: string; building_id: string | null; due_at: string | null;
  scheduled_local: string; description: string | null;
};

export function EditTicketSheet({ ticket, buildings, residentName }: { ticket: EditableTicket; buildings: BuildingOption[]; residentName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [visit, setVisit] = useState<Preview | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-12 items-center gap-1 rounded-xl border border-navy px-4 font-semibold text-navy"><Icon name="edit" size={20} />{t.tickets.edit}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.tickets.edit}>
        <form
          action={(fd) => start(async () => {
            setError("");
            try {
              await updateTicketAction(ticket.id, fd);
              setOpen(false);
              // A new visit time: show the message to the resident, if there is one to send.
              const newVisit = String(fd.get("scheduled_at") ?? "");
              if (residentName && newVisit && newVisit !== ticket.scheduled_local) setVisit(await previewVisitAction(ticket.id));
            } catch { setError("השמירה נכשלה. בדקו את הנתונים ונסו שוב."); }
          })}
          className="flex flex-col gap-3 pb-4"
        >
          <Field label={t.tickets.titleField}><input name="title" required defaultValue={ticket.title} dir="rtl" className={inputCls} /></Field>
          <Field label={t.tickets.category}><select name="category" defaultValue={ticket.category} className={inputCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label={t.tickets.urgency}><select name="urgency" defaultValue={ticket.urgency} className={inputCls}>{URGENCIES.map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label={t.tickets.building}>
            <select name="building_id" defaultValue={ticket.building_id ?? ""} className={inputCls}>
              <option value="">{t.tickets.noBuilding}</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label={t.tickets.dueAt}><input type="date" name="due_at" defaultValue={ticket.due_at ?? ""} dir="ltr" className={inputCls} /></Field>
          <Field label={t.tickets.visitTime}><input type="datetime-local" name="scheduled_at" defaultValue={ticket.scheduled_local} dir="ltr" className={inputCls} /></Field>
          <Field label={t.tickets.description}><textarea name="description" defaultValue={ticket.description ?? ""} dir="rtl" rows={3} className={`${inputCls} h-auto py-2`} /></Field>
          {error && <p className="text-[#B3261E]" role="alert">{error}</p>}
          <button disabled={pending} className="h-12 rounded-xl bg-navy font-semibold text-white disabled:opacity-50">{t.common.save}</button>
        </form>
      </Sheet>
      <MessagePreviewSheet
        open={visit !== null}
        preview={visit}
        residentName={residentName ?? ""}
        sendLabel={t.msg.send}
        busy={pending}
        onSend={(text) => start(async () => { await sendVisitAction(ticket.id, text); setVisit(null); })}
        onClose={() => setVisit(null)}
      />
    </>
  );
}
