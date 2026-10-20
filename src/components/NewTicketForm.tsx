"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Chip } from "./Chip";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { createTicketAction } from "@/app/(app)/tickets/actions";
import { CATEGORIES, KINDS, URGENCIES, t } from "@/lib/labels";
import type { BuildingOption, PersonOption } from "@/lib/db/people";

export function NewTicketForm({ buildings, assignees }: { buildings: BuildingOption[]; assignees: PersonOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"fault" | "task">("fault");
  const [building, setBuilding] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [urgency, setUrgency] = useState<string>("חשוב");
  const [assignee, setAssignee] = useState("");
  const [more, setMore] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [description, setDescription] = useState("");
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const canSave = title.trim().length > 0 && (kind === "task" || building !== null);

  function save() {
    setError("");
    start(async () => {
      try {
        const r = await createTicketAction({
          kind, title, category, urgency, building_id: building, assignee_id: assignee || null,
          due_at: dueAt || null, description: description || null, original_message: original || null,
        });
        router.push(`/tickets/${r.id}`);
      } catch {
        setError("השמירה נכשלה. נסו שוב.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-32">
      <h1 className="text-[22px] font-bold">{t.tickets.newTitle}</h1>
      <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#F1EFEA] p-1" role="group" aria-label={t.tickets.kind}>
        {(["fault", "task"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`flex h-[46px] items-center justify-center gap-1.5 rounded-[11px] text-base ${kind === k ? "bg-navy font-semibold text-white" : ""}`}>
            <Icon name={k === "fault" ? "report" : "task_alt"} size={20} />
            {KINDS[k]}
          </button>
        ))}
      </div>

      <Field label={t.tickets.building} group>
        <div className="flex flex-wrap gap-2">
          {buildings.map((b) => <Chip key={b.id} selected={building === b.id} onClick={() => setBuilding(b.id)}>{b.name}</Chip>)}
          {kind === "task" && <Chip selected={building === null} onClick={() => setBuilding(null)}>{t.tickets.noBuilding}</Chip>}
        </div>
      </Field>

      <Field label={t.tickets.titleField}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" className={inputCls} autoFocus />
      </Field>

      <Field label={t.tickets.category} group>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
        </div>
      </Field>

      <Field label={t.tickets.urgency} group>
        <div className="flex flex-wrap gap-2">
          {URGENCIES.map((u) => <Chip key={u} selected={urgency === u} onClick={() => setUrgency(u)}>{u}</Chip>)}
        </div>
      </Field>

      <Field label={t.tickets.assignee}>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
          <option value="">{t.tickets.unassigned}</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      <button type="button" onClick={() => setMore((m) => !m)} className="self-start text-[15px] font-semibold text-navy underline">{t.tickets.more}</button>
      {more && (
        <div className="flex flex-col gap-4">
          <Field label={t.tickets.dueAt}><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} dir="ltr" className={inputCls} /></Field>
          <Field label={t.tickets.description}><textarea value={description} onChange={(e) => setDescription(e.target.value)} dir="auto" rows={3} className={`${inputCls} h-auto py-2`} /></Field>
          <Field label={t.tickets.originalMessage}><textarea value={original} onChange={(e) => setOriginal(e.target.value)} dir="auto" rows={3} placeholder={t.tickets.pasteMessage} className={`${inputCls} h-auto py-2`} /></Field>
        </div>
      )}

      {error && <p className="text-[#B3261E]" role="alert">{error}</p>}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EFEBE3] bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={save} disabled={!canSave || pending} className="h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-40">
          {t.common.save}
        </button>
      </div>
    </div>
  );
}
