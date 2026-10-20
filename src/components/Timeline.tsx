import { t } from "@/lib/labels";
import { formatDate } from "@/lib/israel";
import type { TicketDetail } from "@/lib/db/tickets";

function describe(e: TicketDetail["events"][number]): string {
  const p = e.payload;
  if (e.type === "status") return `${t.tickets.ev.status}: ${p.from ?? ""} ← ${p.to ?? ""}`;
  if (e.type === "note") return String(p.text ?? "");
  if (e.type === "assignment") return t.tickets.ev.assignment;
  if (e.type === "photo") return t.tickets.ev.photo;
  if (e.type === "edit") return `${t.tickets.ev.edit}: ${Object.keys(p).join(", ")}`;
  return t.tickets.ev[e.type as keyof typeof t.tickets.ev] ?? e.type;
}

export function Timeline({ events }: { events: TicketDetail["events"] }) {
  return (
    <ol className="flex flex-col gap-3">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="rounded-xl bg-white p-3">
          <div dir="rtl" className="text-base">{describe(e)}</div>
          <div className="mt-0.5 text-sm text-muted">{e.actor_name ?? "—"} · <span dir="ltr">{formatDate(new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }))} {new Date(e.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</span></div>
        </li>
      ))}
    </ol>
  );
}
