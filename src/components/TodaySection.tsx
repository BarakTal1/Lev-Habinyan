"use client";
import { useState } from "react";
import { Row } from "./Row";
import { CheckButton } from "./CheckButton";
import { completeRowAction } from "@/app/(app)/actions";

export type SectionRow = {
  id: string;
  kind: "fault" | "task" | "maintenance";
  title: string;
  building: string | null;
  meta: string;
  late: boolean;
  flag?: string;
  badge: { list: "urgency" | "maint"; value: string };
  href?: string;
};

/** One Today section. Check-off hides the row at once and brings it back if the save fails. */
export function TodaySection({ title, sub, rows }: { title: string; sub?: string; rows: SectionRow[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const shown = rows.filter((r) => !hidden.has(r.id));
  if (shown.length === 0) return null;

  async function check(r: SectionRow) {
    setHidden((h) => new Set(h).add(r.id));
    try {
      await completeRowAction(r.kind as "task" | "maintenance", r.id);
    } catch {
      setHidden((h) => {
        const n = new Set(h);
        n.delete(r.id);
        return n;
      });
    }
  }

  return (
    <section className="px-4 pb-5">
      <div className="flex items-baseline gap-2 px-1 pb-2.5">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-sm text-muted">{shown.length}</span>
        <span className="flex-1" />
        {sub && <span className="text-sm text-muted">{sub}</span>}
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3] shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]">
        {shown.map((r) => (
          <Row
            key={r.id}
            kind={r.kind}
            title={r.title}
            building={r.building}
            meta={r.meta}
            late={r.late}
            flag={r.flag}
            badge={r.badge}
            href={r.href}
            trailing={r.kind !== "fault" ? <CheckButton onCheck={() => check(r)} label={`סימון כבוצע: ${r.title}`} /> : undefined}
          />
        ))}
      </div>
    </section>
  );
}
