import { t } from "@/lib/labels";
import { formatDate } from "@/lib/israel";
import type { TicketDetail } from "@/lib/db/tickets";
import { describeEdit } from "@/lib/ticketEvents";

const delivery = (state: unknown) => (typeof state === "string" ? t.msg.delivery[state as keyof typeof t.msg.delivery] ?? state : "");

function describe(e: TicketDetail["events"][number]): string {
  const p = e.payload;
  if (e.type === "status") return `${t.tickets.ev.status}: ${p.from ?? ""} ← ${p.to ?? ""}${p.skippedMessage ? ` · ${t.msg.noMessage}` : ""}`;
  if (e.type === "message") return `${t.tickets.ev.message}: ${String(p.text ?? "")}${p.delivery_state ? ` · ${delivery(p.delivery_state)}` : ""}`;
  if (e.type === "note") return String(p.text ?? "");
  if (e.type === "assignment") return t.tickets.ev.assignment;
  if (e.type === "photo") return t.tickets.ev.photo;
  if (e.type === "edit") return `${t.tickets.ev.edit}: ${describeEdit(p)}`;
  return t.tickets.ev[e.type as keyof typeof t.tickets.ev] ?? e.type;
}

/** Events written by the bot have no founder: say who it was. */
function byWho(p: Record<string, unknown>, type: string): string {
  if (p.by === "resident" || p.from === "resident") return t.msg.fromResident;
  if (type === "created" && p.source === "whatsapp") return t.msg.fromWhatsapp;
  return "—";
}

export function Timeline({ events }: { events: TicketDetail["events"] }) {
  return (
    <ol className="flex flex-col gap-3">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="card p-3.5">
          <div dir="rtl" className="text-base">{describe(e)}</div>
          <div className="mt-0.5 text-sm text-muted">{e.actor_name ?? byWho(e.payload, e.type)} · <span dir="ltr">{formatDate(new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }))} {new Date(e.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</span></div>
        </li>
      ))}
    </ol>
  );
}
