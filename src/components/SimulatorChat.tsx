"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulatorLoadAction, simulatorSendAction, type SimMessage } from "@/app/dev/simulator/actions";
import { newSimulatorPhone } from "@/lib/bot/simulatorPhone";
import type { Inbound, Out } from "@/lib/bot/types";
import { t } from "@/lib/labels";

const POLL_MS = 2000;

const isOut = (p: SimMessage["payload"]): p is Out => p !== null && "type" in p;

/** Buttons and list rows of a bot message, as tappable chips. A tap sends the button id, like a WhatsApp reply. */
function Choices({ out, onPick }: { out: Out; onPick: (id: string) => void }) {
  const items = out.type === "buttons" ? out.buttons : out.type === "list" ? out.rows : [];
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((i) => <button key={i.id} type="button" onClick={() => onPick(i.id)} className="rounded-full border border-navy/30 bg-white px-3 py-1.5 text-sm font-semibold text-navy">{i.title}</button>)}
    </div>
  );
}

function Bubble({ m, onPick }: { m: SimMessage; onPick: (id: string) => void }) {
  const mine = m.direction === "in";
  const p = m.payload;
  const out = !mine && isOut(p) ? p : null;
  const inbound = mine && p && !isOut(p) ? (p as Inbound) : null;
  const text = out?.type === "template" ? `[${t.sim.template}: ${out.name}] ${m.body.replace(/^\[[^\]]*\]\s*/, "")}` : inbound?.kind === "button" ? `⏺ ${inbound.id}` : m.body;
  return (
    <li className={`flex ${mine ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-[#DCF8C6]" : "bg-white shadow-[var(--card-shadow)]"}`}>
        <div className="text-[11px] text-muted">{mine ? t.sim.you : t.sim.bot}</div>
        <p dir="rtl" className="whitespace-pre-line text-[15px]">{text}</p>
        {out && <Choices out={out} onPick={onPick} />}
      </div>
    </li>
  );
}

export function SimulatorChat({ phone, initial }: { phone: string; initial: SimMessage[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<SimMessage[]>(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLLIElement>(null);

  const load = async () => setMessages(await simulatorLoadAction(phone));
  // The first messages come from the server. After that the page asks again every few seconds, so a message the app sends (a founder's status message) shows up.
  useEffect(() => {
    const id = setInterval(() => void simulatorLoadAction(phone).then(setMessages), POLL_MS);
    return () => clearInterval(id);
  }, [phone]);
  useEffect(() => {
    // An effect must return nothing (or a cleanup function), so the scroll call is a statement, not the return value.
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  const send = (fields: Record<string, string>, file?: File) => start(async () => {
    const fd = new FormData();
    fd.set("phone", phone);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    if (file) fd.set("file", file);
    await simulatorSendAction(fd);
    await load();
  });
  const sendText = () => { if (!text.trim()) return; send({ kind: "text", text }); setText(""); };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-muted">{t.sim.phone}
          <input aria-label={t.sim.phone} readOnly value={phone} dir="ltr" className="h-11 rounded-xl border border-line bg-white px-3 text-base text-ink" />
        </label>
        <button type="button" onClick={() => router.replace(`/dev/simulator?phone=${newSimulatorPhone()}`)} className="h-11 rounded-xl border border-navy px-4 font-semibold text-navy">{t.sim.newNumber}</button>
      </div>
      <ol aria-label="chat" className="flex min-h-[320px] flex-1 flex-col gap-2 rounded-2xl bg-[#ECE5DD] p-3">
        {messages.length === 0 && <li className="m-auto text-sm text-muted">{t.sim.empty}</li>}
        {messages.map((m) => <Bubble key={m.id} m={m} onPick={(id) => send({ kind: "button", id })} />)}
        <li ref={end} aria-hidden="true" />
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); sendText(); }} className="flex gap-2">
        <input dir="rtl" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.sim.placeholder} aria-label={t.sim.placeholder} className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-base" />
        <label className="flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-white" aria-label={t.sim.image}>
          📎<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) send({ kind: "image", text }, f); setText(""); e.target.value = ""; }} />
        </label>
        <button disabled={pending} className="h-12 rounded-xl bg-navy px-5 font-semibold text-white disabled:opacity-50">{t.sim.send}</button>
      </form>
    </div>
  );
}
