import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TodaySection, type SectionRow } from "@/components/TodaySection";
import { Fab } from "@/components/Fab";
import { requireUser } from "@/lib/auth";
import { loadToday } from "@/lib/db/today";
import type { TodayRow } from "@/lib/domain/today";
import { ageLabel, dueLabel } from "@/lib/format";
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
      flag: r.flagHours ? `${r.flagHours} שעות ללא טיפול` : undefined,
      badge: r.kind === "maintenance"
        ? { list: "maint", value: section === "overdue" ? "באיחור" : "מתקרב" }
        : { list: "urgency", value: r.urgency ?? "חשוב" },
      href: r.kind === "maintenance" ? undefined : `/tickets/${r.id}`,
    };
  };

  const empty = !data.overdue.length && !data.soon.length && !data.faults.length;
  const dateText = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }).format(now);
  const firstName = user.name.split(" ")[0];

  return (
    <main>
      <header className="flex h-14 items-center gap-2.5 px-4 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-navy text-[15px] font-extrabold text-white">לב</div>
        <div className="flex-1" />
        <Link href="/tickets" aria-label="חיפוש" className="flex h-12 w-12 items-center justify-center"><Icon name="search" size={24} /></Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E3E8F2] text-sm font-bold text-navy">{user.name.slice(0, 1)}</div>
      </header>

      <div className="px-5 pb-4 pt-1 lg:pt-6">
        <h1 className="text-[26px] font-bold leading-tight">{t.today.greeting(firstName)}</h1>
        <p className="mt-0.5 text-[15px] text-muted">{dateText}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-4 pb-5">
        <div className="flex h-[76px] flex-col justify-between rounded-2xl bg-[#FCE4E1] px-3 py-2.5 text-[#B3261E]">
          <div className="flex items-center gap-1 text-sm font-semibold"><Icon name="error" size={18} filled />{t.today.overdue}</div>
          <div className="text-[28px] font-bold leading-none">{data.counts.overdue}</div>
        </div>
        <div className="flex h-[76px] flex-col justify-between rounded-2xl bg-[#E3E8F2] px-3 py-2.5 text-navy">
          <div className="flex items-center gap-1 text-sm font-semibold"><Icon name="today" size={18} />{t.today.todayChip}</div>
          <div className="text-[28px] font-bold leading-none">{data.counts.today}</div>
        </div>
        <div className="flex h-[76px] flex-col justify-between rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]">
          <div className="flex items-center gap-1 text-sm font-semibold"><Icon name="inbox" size={18} />{t.today.open}</div>
          <div className="text-[28px] font-bold leading-none">{data.counts.openFaults}</div>
        </div>
      </div>

      {empty ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-muted">
          <Icon name="check_circle" size={48} filled />
          <p className="text-lg font-semibold">{t.today.empty}</p>
        </div>
      ) : (
        <>
          <TodaySection title={t.today.overdue} rows={data.overdue.map((r) => toRow(r, "overdue"))} />
          <TodaySection title={t.today.soon} sub="14 ימים" rows={data.soon.map((r) => toRow(r, "soon"))} />
          <TodaySection title={t.today.faults} rows={data.faults.map((r) => toRow(r, "faults"))} />
        </>
      )}
      <Fab href="/tickets/new" label="כרטיס חדש" />
    </main>
  );
}
