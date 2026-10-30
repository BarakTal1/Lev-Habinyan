import Link from "next/link";
import { Fab } from "@/components/Fab";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { Row } from "@/components/Row";
import { requireUser } from "@/lib/auth";
import { listAssignees, listBuildings } from "@/lib/db/people";
import { listTickets, type TicketFilters, type TicketKind } from "@/lib/db/tickets";
import { hoursWithoutAction } from "@/lib/domain/tickets";
import { ageLabel, waitLabel } from "@/lib/format";
import { formatDate } from "@/lib/israel";
import { STATUSES, URGENCIES, t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

type SP = { closed?: string; q?: string; kind?: string; status?: string; urgency?: string; building?: string; assignee?: string; mine?: string };

function href(sp: SP, patch: Partial<SP>) {
  const merged = { ...sp, ...patch } as Record<string, string | undefined>;
  const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/tickets?${qs}` : "/tickets";
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const db = await createClient();
  const filters: TicketFilters = {
    q: sp.q, status: sp.status, urgency: sp.urgency, building: sp.building, assignee: sp.assignee, mine: sp.mine === "1", closed: sp.closed === "1",
    kind: sp.kind === "fault" || sp.kind === "task" ? (sp.kind as TicketKind) : undefined,
  };
  const [rows, buildings, assignees] = await Promise.all([listTickets(db, filters, user.personId), listBuildings(db), listAssignees(db)]);
  const now = new Date();
  const chip = (active: boolean) => `press flex h-10 flex-none items-center whitespace-nowrap rounded-full px-3.5 text-[15px] ${active ? "bg-navy font-semibold text-white" : "border border-[#D8DEE8] bg-white"}`;
  const sel = "h-12 w-full rounded-xl bg-[#F4F6FA] px-3 text-base outline-none transition-shadow duration-150 focus:ring-4 focus:ring-navy/10";

  return (
    <main className="mx-auto max-w-[1280px]">
      <PageHeader title={t.tickets.title} sub={`${rows.length} ${sp.closed ? t.tickets.closed : t.tickets.open}`} />
      <form action="/tickets" className="flex gap-2 px-4 pb-3 lg:px-8">
        {sp.kind && <input type="hidden" name="kind" value={sp.kind} />}
        {sp.mine && <input type="hidden" name="mine" value={sp.mine} />}
        {sp.closed && <input type="hidden" name="closed" value={sp.closed} />}
        <input name="q" defaultValue={sp.q ?? ""} dir="rtl" placeholder={t.tickets.search} className="h-12 flex-1 rounded-xl border border-line bg-white px-3.5 text-base shadow-[var(--card-shadow)] outline-none transition-shadow duration-150 placeholder:text-muted/70 focus:ring-4 focus:ring-navy/10" />
        <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white" aria-label={t.tickets.search}><Icon name="search" size={22} /></button>
      </form>
      <div className="no-scrollbar flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-3 lg:px-8">
        <Link href={href(sp, { kind: undefined, mine: undefined })} className={chip(!sp.kind && !sp.mine)}>{t.tickets.all}</Link>
        <Link href={href(sp, { kind: "fault" })} className={chip(sp.kind === "fault")}>{t.tickets.faults}</Link>
        <Link href={href(sp, { kind: "task" })} className={chip(sp.kind === "task")}>{t.tickets.tasks}</Link>
        <Link href={href(sp, { mine: sp.mine ? undefined : "1" })} className={chip(sp.mine === "1")}>{t.tickets.mine}</Link>
        <Link href={href(sp, { closed: sp.closed ? undefined : "1" })} className={chip(sp.closed === "1")}>{t.tickets.closed}</Link>
      </div>
      <details className="px-4 pb-3 lg:px-8">
        <summary className="press flex h-10 w-fit cursor-pointer select-none items-center gap-1 text-[15px] font-semibold text-navy"><Icon name="filter_list" size={20} />{t.tickets.filter}</summary>
        <form action="/tickets" className="rise-in mt-2 flex flex-col gap-2 card p-3">
          {sp.kind && <input type="hidden" name="kind" value={sp.kind} />}
          {sp.mine && <input type="hidden" name="mine" value={sp.mine} />}
          <select name="building" defaultValue={sp.building ?? ""} className={sel}><option value="">{t.tickets.building}</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select name="status" defaultValue={sp.status ?? ""} className={sel}><option value="">{t.tickets.status}</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select name="urgency" defaultValue={sp.urgency ?? ""} className={sel}><option value="">{t.tickets.urgency}</option>{URGENCIES.map((u) => <option key={u}>{u}</option>)}</select>
          <select name="assignee" defaultValue={sp.assignee ?? ""} className={sel}><option value="">{t.tickets.assignee}</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <button className="h-12 rounded-xl bg-navy font-semibold text-white">{t.tickets.apply}</button>
        </form>
      </details>

      {rows.length === 0 ? (
        <p className="px-4 py-16 text-center text-lg font-medium text-muted">{t.tickets.empty}</p>
      ) : (
        <div className="mx-4 flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--card-shadow)] lg:mx-8">
          <div aria-hidden="true" className="hidden h-10 items-center gap-3 bg-[#F8FAFC] pe-3.5 ps-3 text-[13px] font-semibold text-muted lg:flex">
            <span className="flex-1 ps-[88px]">{t.tickets.titleField}</span>
            <span className="w-40 flex-none">{t.tickets.assignee}</span>
            <span className="w-24 flex-none">{t.tickets.dueAt}</span>
            <span className="w-28 flex-none text-end">{t.tickets.urgency}</span>
          </div>
          {rows.map((r) => {
            const flag = hoursWithoutAction({ kind: r.kind, status: r.status, created_at: r.created_at, first_action_at: r.first_action_at }, now);
            return (
              <Row key={r.id} kind={r.kind} title={r.title} building={r.building_name} meta={`${ageLabel(r.created_at, now)} · ${r.status}${r.resident_approved ? "" : ` · ${t.msg.notApproved}`}`}
                flag={flag ? waitLabel(flag) : undefined} badge={{ list: "urgency", value: r.urgency }} href={`/tickets/${r.id}`}
                extra={{ assignee: r.assignee_name, due: r.due_at ? formatDate(r.due_at) : null }} />
            );
          })}
        </div>
      )}
      <Fab href="/tickets/new" label={t.tickets.newTitle} />
    </main>
  );
}
