import Link from "next/link";
import { notFound } from "next/navigation";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { StatusControl } from "@/components/StatusControl";
import { Timeline } from "@/components/Timeline";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditTicketSheet } from "@/components/EditTicketSheet";
import { listAssignees, listBuildings } from "@/lib/db/people";
import { getResident } from "@/lib/bot/send";
import { getTicket } from "@/lib/db/tickets";
import { RequestInfoSheet } from "@/components/RequestInfoSheet";
import { formatDate, isoToIsraelLocal } from "@/lib/israel";
import { KINDS, t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { addNoteAction, archiveTicketAction, saveCostAction, saveOriginalMessageAction, uploadAttachmentAction } from "../actions";

const card = "flex flex-col gap-3 card p-4";
const h = "text-[17px] font-bold tracking-[-0.01em]";
const input = "w-full rounded-xl bg-[#F4F6FA] px-3 text-base outline-none transition-shadow duration-150 focus:ring-4 focus:ring-navy/10";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const [ticket, assignees, buildings] = await Promise.all([getTicket(db, id), listAssignees(db), listBuildings(db)]);
  if (!ticket) notFound();
  const resident = await getResident(db, id);
  const photos = ticket.attachments.filter((a) => a.kind === "photo");
  const invoices = ticket.attachments.filter((a) => a.kind === "invoice");

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-8 lg:px-8">
      <div className="pt-3 lg:pt-6">
        <Link href="/tickets" className="press inline-flex h-10 items-center gap-1 text-[15px] font-semibold text-brand"><Icon name="arrow_forward" size={20} />{t.tickets.title}</Link>
      </div>
      <header className="flex flex-col gap-2 px-1 pb-5 pt-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><Icon name={ticket.kind === "fault" ? "report" : "task_alt"} size={18} />{KINDS[ticket.kind]}</span>
          <span>{t.tickets.number} <span dir="ltr">{ticket.number}</span></span>
          {ticket.building_name && <span>· {ticket.building_name}</span>}
          <Badge list="urgency" value={ticket.urgency} />
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <h1 dir="rtl" className="min-w-0 basis-full text-[28px] font-bold leading-[1.15] lg:basis-0 lg:flex-1 lg:text-[30px]">{ticket.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <EditTicketSheet residentName={resident?.consented ? resident.name : null} ticket={{ id: ticket.id, title: ticket.title, category: ticket.category, urgency: ticket.urgency, building_id: ticket.building_id, due_at: ticket.due_at, scheduled_local: ticket.scheduled_at ? isoToIsraelLocal(ticket.scheduled_at) : "", description: ticket.description }} buildings={buildings} />
            {resident?.consented && <RequestInfoSheet ticketId={ticket.id} number={ticket.number} />}
            <ConfirmForm action={archiveTicketAction.bind(null, ticket.id)} message={t.tickets.archiveConfirm}>
              <button className="flex h-12 items-center gap-1 rounded-xl px-3 font-semibold text-muted"><Icon name="inventory_2" size={20} />{t.tickets.archive}</button>
            </ConfirmForm>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Side column: what a founder changes most. On phones it comes first. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2">
          <section className={card}><StatusControl id={ticket.id} status={ticket.status} residentName={resident?.consented ? resident.name : null} /></section>
          <section className={card}>
            <h2 className={h}>{t.tickets.assignee}</h2>
            <AssigneeSelect id={ticket.id} value={ticket.assignee_id} options={assignees} />
          </section>
          <section className={card}>
            <h2 className={h}>{t.tickets.details}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
              <dt className="text-muted">{t.tickets.category}</dt><dd>{ticket.category}</dd>
              <dt className="text-muted">{t.tickets.building}</dt><dd>{ticket.building_id ? <Link href={`/buildings/${ticket.building_id}`} className="font-semibold text-brand">{ticket.building_name}</Link> : t.tickets.noBuilding}</dd>
              {ticket.due_at && <><dt className="text-muted">{t.tickets.dueAt}</dt><dd><span dir="ltr">{formatDate(ticket.due_at)}</span></dd></>}
              {ticket.scheduled_at && <><dt className="text-muted">{t.tickets.visit}</dt><dd><span dir="ltr">{isoToIsraelLocal(ticket.scheduled_at).replace("T", " ")}</span></dd></>}
            </dl>
          </section>
        </aside>

        <div className="flex flex-col gap-4 lg:order-1">
          {ticket.description && (
            <section className={card}>
              <h2 className={h}>{t.tickets.description}</h2>
              <p dir="rtl" className="whitespace-pre-line text-base">{ticket.description}</p>
            </section>
          )}
          <section className={card}>
            <h2 className={h}>{t.tickets.originalMessage}</h2>
            <form action={saveOriginalMessageAction.bind(null, ticket.id)} className="flex flex-col gap-2">
              <textarea name="text" dir="rtl" rows={3} defaultValue={ticket.original_message ?? ""} placeholder={t.tickets.pasteMessage} className={`${input} py-2`} />
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
              <input name="text" dir="rtl" required className={`${input} h-12`} />
              <button className="h-12 rounded-xl bg-navy px-4 font-semibold text-white">{t.tickets.addNote}</button>
            </form>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className={`${h} px-1`}>{t.tickets.timeline}</h2>
            <Timeline events={ticket.events} />
          </section>
        </div>
      </div>
    </main>
  );
}
