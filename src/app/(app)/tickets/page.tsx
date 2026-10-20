import Link from "next/link";
import { Fab } from "@/components/Fab";
import { Icon } from "@/components/Icon";
import { Row } from "@/components/Row";
import { requireUser } from "@/lib/auth";
import { listAssignees, listBuildings } from "@/lib/db/people";
import { listTickets, type TicketFilters, type TicketKind } from "@/lib/db/tickets";
import { hoursWithoutAction } from "@/lib/domain/tickets";
import { ageLabel } from "@/lib/format";
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
  const chip = (active: boolean) => `flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[15px] ${active ? "bg-navy font-semibold text-white" : "border border-[#DAD5CB] bg-white"}`;
  const sel = "h-12 w-full rounded-xl bg-[#F7F5F0] px-3 text-base";

  return (
    <main>
      <h1 className="px-5 pb-3 pt-5 text-[26px] font-bold">{t.tickets.title}</h1>
      <form action="/tickets" className="flex gap-2 px-4 pb-3">
        {sp.kind && <input type="hidden" name="kind" value={sp.kind} />}
        {sp.mine && <input type="hidden" name="mine" value={sp.mine} />}
        {sp.closed && <input type="hidden" name="closed" value={sp.closed} />}
        <input name="q" defaultValue={sp.q ?? ""} dir="rtl" placeholder={t.tickets.search} className="h-12 flex-1 rounded-xl bg-white px-3 text-base shadow-[0_1px_2px_rgba(27,42,74,.06)]" />
        <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white" aria-label={t.tickets.search}><Icon name="search" size={22} /></button>
      </form>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        <Link href={href(sp, { kind: undefined, mine: undefined })} className={chip(!sp.kind && !sp.mine)}>{t.tickets.all}</Link>
        <Link href={href(sp, { kind: "fault" })} className={chip(sp.kind === "fault")}>{t.tickets.faults}</Link>
        <Link href={href(sp, { kind: "task" })} className={chip(sp.kind === "task")}>{t.tickets.tasks}</Link>
        <Link href={href(sp, { mine: sp.mine ? undefined : "1" })} className={chip(sp.mine === "1")}>{t.tickets.mine}</Link>
        <Link href={href(sp, { closed: sp.closed ? undefined : "1" })} className={chip(sp.closed === "1")}>{t.tickets.closed}</Link>
      </div>
      <details className="px-4 pb-3">
        <summary className="flex h-10 cursor-pointer items-center gap-1 text-[15px] font-semibold text-navy"><Icon name="filter_list" size={20} />{t.tickets.filter}</summary>
        <form action="/tickets" className="mt-2 flex flex-col gap-2 rounded-2xl bg-white p-3">
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
        <p className="px-4 py-16 text-center text-lg text-muted">{t.tickets.empty}</p>
      ) : (
        <div className="mx-4 flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3] shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]">
          {rows.map((r) => {
            const flag = hoursWithoutAction({ kind: r.kind, status: r.status, created_at: r.created_at, first_action_at: r.first_action_at }, now);
            return (
              <Row key={r.id} kind={r.kind} title={r.title} building={r.building_name} meta={`${ageLabel(r.created_at, now)} · ${r.status}`}
                flag={flag ? `${flag} שעות ללא טיפול` : undefined} badge={{ list: "urgency", value: r.urgency }} href={`/tickets/${r.id}`}
                extra={{ assignee: r.assignee_name, due: r.due_at ? formatDate(r.due_at) : null }} />
            );
          })}
        </div>
      )}
      <Fab href="/tickets/new" label={t.tickets.newTitle} />
    </main>
  );
}
