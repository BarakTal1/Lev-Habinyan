"use client";
import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { createFeedTokenAction, revokeFeedTokenAction } from "@/app/(app)/calendar/actions";
import { t } from "@/lib/labels";

const btn = "press flex h-12 items-center justify-center rounded-xl px-4 font-semibold";

export function CalendarExport({ feedUrl }: { feedUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run(fn: () => Promise<void>) {
    setError("");
    start(async () => {
      try {
        await fn();
      } catch {
        setError("הפעולה נכשלה. נסו שוב.");
      }
    });
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("ההעתקה נכשלה. סמנו את הקישור והעתיקו ידנית.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press flex h-12 items-center gap-1.5 rounded-xl border border-[#D8DEE8] bg-white px-3.5 font-semibold text-navy">
        <Icon name="upload_file" size={20} />
        {t.cal.export}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.cal.exportTitle}>
        <div className="flex flex-col gap-4 px-5 pb-6">
          <p className="text-[15px] leading-relaxed">{t.cal.exportIntro}</p>
          {feedUrl ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-muted">{t.cal.link}</span>
                <input readOnly value={feedUrl} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="h-12 w-full rounded-xl border border-[#D8DEE8] bg-[#F4F6FA] px-3 text-sm" />
              </label>
              <button type="button" onClick={copy} className={`${btn} bg-navy text-white`}>{copied ? t.cal.copied : t.cal.copy}</button>
              <ol className="list-decimal space-y-1.5 ps-5 text-[15px]">{t.cal.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="text-sm text-muted">{t.cal.delay}</p>
              <p className="text-sm font-semibold text-[#8A5300]">{t.cal.secretWarn}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => run(createFeedTokenAction)} className={`${btn} border border-[#D8DEE8]`}>{t.cal.rotate}</button>
                <button type="button" disabled={pending} onClick={() => run(revokeFeedTokenAction)} className={`${btn} border border-[#E8C4BE] text-[#B3261E]`}>{t.cal.revoke}</button>
              </div>
              <p className="text-sm text-muted">{t.cal.rotateHint}</p>
            </>
          ) : (
            <button type="button" disabled={pending} onClick={() => run(createFeedTokenAction)} className={`${btn} bg-navy text-white`}>{t.cal.create}</button>
          )}
          <a href="/calendar/export" download className={`${btn} border border-[#D8DEE8]`}>{t.cal.download}</a>
          {error && <p role="alert" className="rounded-xl bg-[#FCE4E1] p-3 text-[#B3261E]">{error}</p>}
        </div>
      </Sheet>
    </>
  );
}
