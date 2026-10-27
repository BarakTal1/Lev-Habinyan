"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { Plaque } from "./Plaque";
import { dayLabel, eventsByDay, monthGrid, monthLabel, shiftMonth, type CalEvent, type CalKind } from "@/lib/domain/calendar";
import { googleAddUrl } from "@/lib/domain/ics";
import { t } from "@/lib/labels";
import { splitAddress } from "@/lib/address";

const KINDS: CalKind[] = ["visit", "due", "maintenance", "opened"];
const COLOR: Record<CalKind, string> = { visit: "#1F4FA3", due: "#D9822B", maintenance: "#0B6B5F", opened: "#8A909C" };

export function CalendarView({ month, today, events, origin, children }: { month: string; today: string; events: CalEvent[]; origin: string; children?: React.ReactNode }) {
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [kinds, setKinds] = useState<Set<CalKind>>(new Set(KINDS));
  const [building, setBuilding] = useState("");

  const buildings = useMemo(() => [...new Set(events.map((e) => e.building).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, "he")), [events]);
  const shown = useMemo(() => events.filter((e) => kinds.has(e.kind) && (!building || e.building === building)), [events, kinds, building]);
  const byDay = useMemo(() => eventsByDay(shown), [shown]);
  const weeks = monthGrid(month);
  const dayEvents = byDay[selected] ?? [];

  const toggle = (k: CalKind) => setKinds((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Link href={`/calendar?m=${shiftMonth(month, -1)}`} aria-label={t.cal.prev} className="press flex h-12 w-12 items-center justify-center rounded-xl border border-[#DAD5CB] bg-white"><Icon name="chevron_left" size={22} className="rotate-180" /></Link>
        <h2 className="min-w-[8.5rem] text-center text-xl font-bold">{monthLabel(month)}</h2>
        <Link href={`/calendar?m=${shiftMonth(month, 1)}`} aria-label={t.cal.next} className="press flex h-12 w-12 items-center justify-center rounded-xl border border-[#DAD5CB] bg-white"><Icon name="chevron_left" size={22} /></Link>
        {!today.startsWith(month) && <Link href="/calendar" className="press flex h-12 items-center rounded-xl px-3 font-semibold text-navy">{t.cal.today}</Link>}
        <span className="flex-1" />
        {children}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1" role="group" aria-label={t.cal.filters}>
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kinds.has(k)} onClick={() => toggle(k)}
            className={`press inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${kinds.has(k) ? "border-transparent bg-white" : "border-dashed border-[#CFC9BD] text-muted"}`}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: kinds.has(k) ? COLOR[k] : "transparent", border: `1.5px solid ${COLOR[k]}` }} />
            {t.cal.kinds[k]}
          </button>
        ))}
        <select aria-label={t.cal.allBuildings} value={building} onChange={(e) => setBuilding(e.target.value)} className="h-9 rounded-full border border-[#DAD5CB] bg-white px-3 text-sm">
          <option value="">{t.cal.allBuildings}</option>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white">
        <div className="grid grid-cols-7 border-b border-[#F3F0EA] text-center text-[13px] font-semibold text-muted">
          {t.cal.weekdays.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-[#F3F0EA] last:border-b-0">
            {week.map((d) => {
              const list = byDay[d] ?? [];
              const inMonth = d.startsWith(month);
              const isToday = d === today;
              const isSel = d === selected;
              const kindsHere = KINDS.filter((k) => list.some((e) => e.kind === k));
              return (
                <button key={d} type="button" onClick={() => setSelected(d)} aria-pressed={isSel}
                  aria-label={`${dayLabel(d)}${list.length ? `, ${list.length} אירועים` : ""}`}
                  className={`press-row relative flex min-h-[56px] flex-col items-center gap-1 border-s border-[#F3F0EA] p-1 first:border-s-0 lg:min-h-[96px] lg:items-stretch lg:p-1.5 ${inMonth ? "" : "bg-[#FBFAF6] text-[#A9AEB8]"} ${isSel ? "bg-[#E3E8F2]" : ""}`}>
                  <span className={`flex h-7 w-7 items-center justify-center self-center rounded-full text-[15px] font-semibold lg:self-start ${isToday ? "bg-navy text-white" : ""}`}>{Number(d.slice(8))}</span>
                  <span className="flex items-center gap-0.5 lg:hidden">
                    {kindsHere.map((k) => <span key={k} aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLOR[k] }} />)}
                  </span>
                  <span className="hidden flex-col gap-0.5 text-start lg:flex">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={`truncate rounded px-1 text-[12px] leading-[18px] ${e.done ? "line-through opacity-60" : ""}`} style={{ backgroundColor: `${COLOR[e.kind]}1F`, color: COLOR[e.kind] }}>{e.time ? `${e.time} ` : ""}{e.title}</span>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[12px] text-muted">+{list.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-live="polite" className="px-1">
        <h3 className="pb-2 text-lg font-bold">{dayLabel(selected)}</h3>
        {dayEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#CFC9BD] p-5 text-center text-muted">{t.cal.noEvents}</p>
        ) : (
          <ul className="flex flex-col gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[#EFEBE3]">
            {dayEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-3 bg-white p-3">
                {e.building ? <Plaque name={e.building} /> : <span aria-hidden className="h-10 w-10 flex-none rounded-[10px] border border-[var(--hairline)]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: COLOR[e.kind] }}>
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[e.kind] }} />
                    {t.cal.kinds[e.kind]}{e.time && <span dir="ltr"> · {e.time}</span>}
                  </div>
                  {e.href ? <Link href={e.href} className={`block font-semibold ${e.done ? "line-through opacity-60" : ""}`}>{e.title}</Link> : <div className="font-semibold">{e.title}</div>}
                  {e.building && <div className="text-sm text-muted">{splitAddress(e.building).street}</div>}
                </div>
                {e.kind !== "opened" && (
                  <a href={googleAddUrl(e, origin)} target="_blank" rel="noopener noreferrer" className="press flex h-12 flex-none items-center rounded-xl px-2 text-sm font-semibold text-navy">{t.cal.addGoogle}</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
