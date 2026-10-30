"use client";
import Link from "next/link";
import { useState } from "react";
import { Row } from "./Row";
import { CheckButton } from "./CheckButton";
import { completeRowAction } from "@/app/(app)/actions";
import { t } from "@/lib/labels";

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
  const [notice, setNotice] = useState<"needsFrequency" | "failed" | null>(null);
  const shown = rows.filter((r) => !hidden.has(r.id));

  async function check(r: SectionRow) {
    setNotice(null);
    setHidden((h) => new Set(h).add(r.id));
    try {
      const res = await completeRowAction(r.kind as "task" | "maintenance", r.id);
      if (res.needsFrequency) setNotice("needsFrequency");
    } catch {
      setNotice("failed");
      setHidden((h) => {
        const n = new Set(h);
        n.delete(r.id);
        return n;
      });
    }
  }

  const banner = notice && (
    <div role={notice === "failed" ? "alert" : "status"} className={`mb-3 rounded-xl p-3 ${notice === "failed" ? "bg-[#FCE4E1] text-[#B3261E]" : "bg-[#FDF0DC] text-[#7A4A00]"}`}>
      {notice === "failed" ? t.today.failed : <>{t.today.needsFrequency} <Link href="/maintenance" className="font-semibold underline">{t.today.toCalendar}</Link></>}
    </div>
  );
  if (shown.length === 0) return banner ? <section className="px-4 pb-5">{banner}</section> : null;

  return (
    <section className="px-4 pb-5">
      {banner}
      <div className="flex items-baseline gap-2 px-1 pb-2.5">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-sm text-muted">{shown.length}</span>
        <span className="flex-1" />
        {sub && <span className="text-sm text-muted">{sub}</span>}
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--card-shadow)]">
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
