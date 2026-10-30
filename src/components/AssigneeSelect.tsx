"use client";
import { useTransition } from "react";
import { assignAction } from "@/app/(app)/tickets/actions";
import { t } from "@/lib/labels";
import type { PersonOption } from "@/lib/db/people";

export function AssigneeSelect({ id, value, options }: { id: string; value: string | null; options: PersonOption[] }) {
  const [pending, start] = useTransition();
  return (
    <select value={value ?? ""} disabled={pending} onChange={(e) => start(() => assignAction(id, e.target.value || null))} aria-label={t.tickets.assignee} className="h-12 w-full rounded-xl bg-[#F4F6FA] px-3 text-base outline-none transition-shadow duration-150 focus:ring-4 focus:ring-navy/10">
      <option value="">{t.tickets.unassigned}</option>
      {options.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );
}
