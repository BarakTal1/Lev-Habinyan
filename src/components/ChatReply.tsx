"use client";
import { useState, useTransition } from "react";
import { replyInChatAction } from "@/app/(app)/inbox/actions";
import { t } from "@/lib/labels";

/** The answer box of one chat. Inside the 24-hour window the founder writes; outside, the box is locked. */
export function ChatReply({ phone, insideWindow }: { phone: string; insideWindow: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!insideWindow) return <p role="note" className="text-sm text-[#7A4A00]">{t.inbox.locked}</p>;
  const send = () => start(async () => {
    setError("");
    const r = await replyInChatAction(phone, text);
    if (r.error === "window") setError(t.inbox.locked);
    else if (r.error) setError(t.inbox.failed);
    else setText("");
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">{t.inbox.reply}</span>
        <textarea dir="rtl" rows={2} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-[#D8DEE8] bg-white p-3 text-base outline-none focus:border-navy/40 focus:ring-4 focus:ring-navy/10" />
      </label>
      {error && <p role="alert" className="text-[#B3261E]">{error}</p>}
      <button disabled={pending || !text.trim()} className="h-12 self-start rounded-xl bg-navy px-6 font-semibold text-white disabled:opacity-40">{t.inbox.send}</button>
    </form>
  );
}
