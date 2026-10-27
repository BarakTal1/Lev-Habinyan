import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TodaySection, type SectionRow } from "@/components/TodaySection";
import { Fab } from "@/components/Fab";
import { requireUser } from "@/lib/auth";
import { loadToday } from "@/lib/db/today";
import type { TodayRow } from "@/lib/domain/today";
import { ageLabel, dueLabel, waitLabel } from "@/lib/format";
import { t } from "@/lib/labels";
import { todayIL } from "@/lib/israel";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const today = todayIL(now);
  const data = await loadToday(await createClient(), now);

  const toRow = (r: TodayRow, section: "overdue" | "soon" | "faults"): SectionRow => {
    const isFault = r.kind === "fault" && section === "faults";
    const label = isFault ? { text: ageLabel(r.due ?? now.toISOString(), now), late: false } : dueLabel(r.due, today);
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      building: r.building,
      meta: label.text,
      late: label.late,
      flag: r.flagHours ? waitLabel(r.flagHours) : undefined,
      badge: r.kind === "maintenance"
        ? { list: "maint", value: section === "overdue" ? "באיחור" : "מתקרב" }
        : { list: "urgency", value: r.urgency ?? "חשוב" },
      href: r.kind === "maintenance" ? undefined : `/tickets/${r.id}`,
    };
  };

  const isUrgent = (r: TodayRow) => r.urgency === "סכנה" || r.urgency === "דחוף";
  const urgentFaults = data.faults.filter(isUrgent);
  const otherFaults = data.faults.filter((r) => !isUrgent(r));
  const empty = !data.overdue.length && !data.soon.length && !data.faults.length;
  const dateText = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }).format(now);
  const firstName = user.name.split(" ")[0];
  const headline = urgentFaults.length > 0 ? t.today.urgentHeadline(urgentFaults.length) : data.counts.overdue > 0 ? t.today.overdueHeadline(data.counts.overdue) : t.today.empty;

  return (
    <main>
      <header className="flex h-14 items-center gap-2.5 px-4 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-navy text-[15px] font-extrabold text-white">לב</div>
        <div className="flex-1" />
        <Link href="/tickets" aria-label="חיפוש" className="press flex h-12 w-12 items-center justify-center"><Icon name="search" size={24} /></Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E3E8F2] text-sm font-bold text-navy">{user.name.slice(0, 1)}</div>
      </header>

      <div className="px-5 pb-5 pt-1 lg:pt-6">
        <p className="text-[15px] text-muted">{t.today.greeting(firstName)} · {dateText}</p>
        <h1 className="mt-1 text-[32px] font-bold leading-[1.1]">{headline}</h1>
        {!empty && (
          <p className="mt-2 flex flex-wrap gap-x-4 text-[15px] text-muted">
            <span><b className="font-bold text-ink">{data.counts.overdue}</b> {t.today.overdue}</span>
            <span><b className="font-bold text-ink">{data.counts.openFaults}</b> {t.today.faults}</span>
            {data.counts.today > 0 && <span><b className="font-bold text-ink">{data.counts.today}</b> {t.today.todayChip}</span>}
          </p>
        )}
      </div>

      {empty ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-muted">
          <Icon name="check_circle" size={48} filled />
          <p className="text-lg font-semibold">{t.today.empty}</p>
        </div>
      ) : (
        <>
          <TodaySection title={t.today.urgentNow} rows={urgentFaults.map((r) => toRow(r, "faults"))} />
          <div data-testid="today-columns" className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:px-4">
            <div>
              <TodaySection title={t.today.overdue} rows={data.overdue.map((r) => toRow(r, "overdue"))} />
              <TodaySection title={t.today.soon} sub="14 ימים" rows={data.soon.map((r) => toRow(r, "soon"))} />
            </div>
            <div>
              <TodaySection title={t.today.faults} rows={otherFaults.map((r) => toRow(r, "faults"))} />
            </div>
          </div>
        </>
      )}
      <Fab href="/tickets/new" label="כרטיס חדש" />
    </main>
  );
}
