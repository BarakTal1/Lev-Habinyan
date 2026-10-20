import Link from "next/link";
import { notFound } from "next/navigation";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { StatusControl } from "@/components/StatusControl";
import { Timeline } from "@/components/Timeline";
import { listAssignees } from "@/lib/db/people";
import { getTicket } from "@/lib/db/tickets";
import { formatDate } from "@/lib/israel";
import { KINDS, t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { addNoteAction, saveCostAction, saveOriginalMessageAction, uploadAttachmentAction } from "../actions";

const card = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]";
const h = "text-[17px] font-bold";
const input = "w-full rounded-xl bg-[#F7F5F0] px-3 text-base";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const [ticket, assignees] = await Promise.all([getTicket(db, id), listAssignees(db)]);
  if (!ticket) notFound();
  const photos = ticket.attachments.filter((a) => a.kind === "photo");
  const invoices = ticket.attachments.filter((a) => a.kind === "invoice");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Link href="/tickets" className="flex h-12 items-center gap-1 text-navy"><Icon name="arrow_forward" size={22} /></Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><Icon name={ticket.kind === "fault" ? "report" : "task_alt"} size={18} />{KINDS[ticket.kind]}</span>
          <span>{t.tickets.number} <span dir="ltr">{ticket.number}</span></span>
          {ticket.building_name && <span>· {ticket.building_name}</span>}
          <Badge list="urgency" value={ticket.urgency} />
        </div>
        <h1 dir="auto" className="text-2xl font-bold leading-snug">{ticket.title}</h1>
        <div className="text-sm text-muted">{ticket.category}{ticket.due_at && <> · {t.tickets.dueAt} <span dir="ltr">{formatDate(ticket.due_at)}</span></>}</div>
        {ticket.description && <p dir="auto" className="text-base">{ticket.description}</p>}
      </header>

      <section className={card}><StatusControl id={ticket.id} status={ticket.status} /></section>

      <section className={card}>
        <h2 className={h}>{t.tickets.assignee}</h2>
        <AssigneeSelect id={ticket.id} value={ticket.assignee_id} options={assignees} />
      </section>

      <section className={card}>
        <h2 className={h}>{t.tickets.originalMessage}</h2>
        <form action={saveOriginalMessageAction.bind(null, ticket.id)} className="flex flex-col gap-2">
          <textarea name="text" dir="auto" rows={3} defaultValue={ticket.original_message ?? ""} placeholder={t.tickets.pasteMessage} className={`${input} py-2`} />
          <button className="h-12 rounded-xl border border-navy font-semibold text-navy">{t.tickets.saveMessage}</button>
        </form>
      </section>

      <section className={card}>
        <h2 className={h}>{t.tickets.photos}</h2>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => p.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={p.id} href={p.url}><img src={p.url} alt="" className="h-24 w-24 rounded-xl object-cover" /></a>
          ))}
        </div>
        <form action={uploadAttachmentAction.bind(null, ticket.id, "photo")} className="flex gap-2">
          <input type="file" name="file" accept="image/*" capture="environment" required className="min-w-0 flex-1 text-sm" />
          <button className="h-12 rounded-xl border border-navy px-4 font-semibold text-navy">{t.tickets.addPhoto}</button>
        </form>
      </section>

      <section className={card}>
        <h2 className={h}>{t.tickets.cost}</h2>
        <form action={saveCostAction.bind(null, ticket.id)} className="flex gap-2">
          <input name="cost" inputMode="decimal" dir="ltr" defaultValue={ticket.cost_amount ?? ""} className={`${input} h-12`} />
          <button className="h-12 rounded-xl border border-navy px-4 font-semibold text-navy">{t.common.save}</button>
        </form>
        <div className="flex flex-col gap-1">
          {invoices.map((a) => a.url && <a key={a.id} href={a.url} className="text-navy underline">{t.tickets.invoice}</a>)}
        </div>
        <form action={uploadAttachmentAction.bind(null, ticket.id, "invoice")} className="flex gap-2">
          <input type="file" name="file" required className="min-w-0 flex-1 text-sm" />
          <button className="h-12 rounded-xl border border-navy px-4 font-semibold text-navy">{t.tickets.addInvoice}</button>
        </form>
      </section>

      <section className={card}>
        <h2 className={h}>{t.tickets.notes}</h2>
        <form action={addNoteAction.bind(null, ticket.id)} className="flex gap-2">
          <input name="text" dir="auto" required className={`${input} h-12`} />
          <button className="h-12 rounded-xl bg-navy px-4 font-semibold text-white">{t.tickets.addNote}</button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={`${h} px-1`}>{t.tickets.timeline}</h2>
        <Timeline events={ticket.events} />
      </section>
    </main>
  );
}
