"use client";
import { useState, useTransition } from "react";
import { requestInfoAction } from "@/app/(app)/tickets/actions";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { buildPreview } from "@/lib/bot/templates";
import { t } from "@/lib/labels";

/** A question to the resident ("ticket_info"). It shows the message as the resident will read it. */
export function RequestInfoSheet({ ticketId, number }: { ticketId: string; number: number }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    setError("");
    const r = await requestInfoAction(ticketId, question);
    if (r.error === "question") setError(t.msg.needQuestion);
    else if (r.error === "contact") setError(t.msg.noContact);
    else if (r.delivery === "failed") setError(t.msg.sendFailed);
    else { setOpen(false); setQuestion(""); }
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-12 items-center gap-1 rounded-xl px-3 font-semibold text-navy"><Icon name="chat" size={20} />{t.msg.askInfo}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.msg.askInfo}
        footer={<button type="button" disabled={pending} onClick={send} className="h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-50">{t.msg.sendQuestion}</button>}>
        <div className="flex flex-col gap-3 pb-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-muted">{t.msg.question}</span>
            <textarea dir="rtl" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full rounded-xl border border-[#D8DEE8] bg-white p-3 text-base outline-none focus:border-navy/40 focus:ring-4 focus:ring-navy/10" />
          </label>
          {question.trim() && <p dir="rtl" className="rounded-xl bg-[#F4F6FA] p-3 text-base">{buildPreview("info", { number, residentName: "-", question }, null, new Date()).text}</p>}
          {error && <p role="alert" className="text-[#B3261E]">{error}</p>}
        </div>
      </Sheet>
    </>
  );
}
