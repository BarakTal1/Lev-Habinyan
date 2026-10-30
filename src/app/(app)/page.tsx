import Link from "next/link";
import type { ReactNode } from "react";
import { BuildingChart, TrendChart } from "@/components/DashboardCharts";
import { Icon } from "@/components/Icon";
import { StatCard } from "@/components/StatCard";
import { TodaySection, type SectionRow } from "@/components/TodaySection";
import { Fab } from "@/components/Fab";
import { requireUser } from "@/lib/auth";
import { loadLedger } from "@/lib/db/ledger";
import { loadToday, loadTrend } from "@/lib/db/today";
import { formatILS } from "@/lib/domain/money";
import { openByBuilding } from "@/lib/domain/dashboard";
import type { TodayRow } from "@/lib/domain/today";
import { ageLabel, dueLabel, waitLabel } from "@/lib/format";
import { t } from "@/lib/labels";
import { todayIL } from "@/lib/israel";
import { createClient } from "@/lib/supabase/server";

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline gap-2 pb-3">
        <h2 className="text-[16px] font-bold">{title}</h2>
        {sub && <span className="text-[13px] text-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const today = todayIL(now);
  const db = await createClient();
  const [data, trend, ledger] = await Promise.all([loadToday(db, now), loadTrend(db, now), loadLedger(db, { today })]);

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
  const byBuilding = openByBuilding(data.faults);
  const empty = !data.overdue.length && !data.soon.length && !data.faults.length;
  const dateText = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }).format(now);
  const firstName = user.name.split(" ")[0];
  const headline = urgentFaults.length > 0 ? t.today.urgentHeadline(urgentFaults.length) : data.counts.overdue > 0 ? t.today.overdueHeadline(data.counts.overdue) : t.today.empty;
  const s = t.today.stats;

  return (
    <main className="mx-auto max-w-[1280px]">
      <header className="flex h-14 items-center gap-2.5 px-4 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-navy text-[15px] font-extrabold text-white">לב</div>
        <div className="flex-1" />
        <Link href="/tickets" aria-label="חיפוש" className="press flex h-12 w-12 items-center justify-center"><Icon name="search" size={24} /></Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF1FC] text-sm font-bold text-navy">{user.name.slice(0, 1)}</div>
      </header>

      <div className="px-5 pb-5 pt-1 lg:px-8 lg:pt-8">
        <p className="text-[15px] text-muted">{t.today.greeting(firstName)} · {dateText}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-[1.15] lg:text-[30px]">{headline}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-4 lg:grid-cols-5 lg:gap-4 lg:px-8">
        <StatCard label={s.open} value={data.counts.openFaults} icon="report" hint={s.openHint} href="/tickets?kind=fault" />
        <StatCard label={s.urgent} value={urgentFaults.length} icon="warning" tone={urgentFaults.length ? "danger" : "ok"} hint={s.urgentHint} />
        <StatCard label={s.overdue} value={data.counts.overdue} icon="schedule" tone={data.counts.overdue ? "warn" : "ok"} hint={s.overdueHint} />
        <StatCard label={s.soon} value={data.soon.length} icon="event" hint={s.soonHint} href="/calendar" />
        <StatCard label={t.ledger.totalDebt} value={formatILS(ledger.totals.debt)} icon="payments" tone={ledger.totals.debt > 0 ? "danger" : "ok"} hint={`${ledger.totals.debtors} ${t.ledger.debtors}`} href="/payments" />
      </div>

      <div className="grid gap-3 px-4 pb-6 lg:grid-cols-3 lg:gap-4 lg:px-8">
        <div className="lg:col-span-2">
          <ChartCard title={t.today.trendTitle} sub={t.today.trendSub}><TrendChart data={trend} /></ChartCard>
        </div>
        <ChartCard title={t.today.byBuildingTitle}>
          {byBuilding.length ? <BuildingChart data={byBuilding} /> : <p className="py-10 text-center text-muted">{t.today.noOpenFaults}</p>}
        </ChartCard>
      </div>

      {empty ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-muted">
          <Icon name="check_circle" size={48} filled />
          <p className="text-lg font-semibold">{t.today.empty}</p>
        </div>
      ) : (
        <div className="lg:px-4">
          <TodaySection title={t.today.urgentNow} rows={urgentFaults.map((r) => toRow(r, "faults"))} />
          <div data-testid="today-columns" className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-2">
            <div>
              <TodaySection title={t.today.overdue} rows={data.overdue.map((r) => toRow(r, "overdue"))} />
              <TodaySection title={t.today.soon} sub="14 ימים" rows={data.soon.map((r) => toRow(r, "soon"))} />
            </div>
            <div>
              <TodaySection title={t.today.faults} rows={otherFaults.map((r) => toRow(r, "faults"))} />
            </div>
          </div>
        </div>
      )}
      <Fab href="/tickets/new" label="כרטיס חדש" />
    </main>
  );
}
