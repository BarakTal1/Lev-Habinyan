"use client";
import { useState } from "react";
import { Sheet } from "./Sheet";
import type { Preview } from "@/lib/bot/templates";
import { t } from "@/lib/labels";

const M = t.msg;

type Props = {
  open: boolean;
  preview: Preview | null;
  residentName: string;
  /** The main button, for example "send message and change status". */
  sendLabel: string;
  /** The second button, for example "change status without a message". Leave out when there is no such action: a cancel button shows instead. */
  skipLabel?: string;
  busy?: boolean;
  /** Called with the edited text, or undefined when the text cannot be edited (outside the 24-hour window). */
  onSend: (text?: string) => void;
  onSkip?: () => void;
  onClose: () => void;
};

/** The message a founder is about to send to a resident. Inside the 24-hour window the text can be edited; outside, only the approved template goes out. */
export function MessagePreviewSheet({ open, preview, residentName, sendLabel, skipLabel, busy, onSend, onSkip, onClose }: Props) {
  // Remember the edit for the preview it belongs to, so a new preview starts from its own text.
  const [edit, setEdit] = useState<{ text: string; value: string } | null>(null);
  const value = preview && edit?.text === preview.text ? edit.value : preview?.text ?? "";
  const button = "h-14 w-full rounded-2xl text-[17px] font-bold disabled:opacity-50";
  return (
    <Sheet
      open={open && preview !== null}
      onClose={onClose}
      title={M.previewTitle}
      footer={preview && (
        <div className="flex flex-col gap-2">
          <button type="button" disabled={busy} onClick={() => onSend(preview.editable ? value : undefined)} className={`${button} bg-navy text-white`}>{sendLabel}</button>
          {onSkip && skipLabel
            ? <button type="button" disabled={busy} onClick={onSkip} className={`${button} border border-navy bg-white text-navy`}>{skipLabel}</button>
            : <button type="button" disabled={busy} onClick={onClose} className={`${button} border border-line bg-white text-navy`}>{M.cancel}</button>}
        </div>
      )}
    >
      {preview && (
        <div className="flex flex-col gap-3 pb-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
            <dt className="text-muted">{M.to}</dt><dd dir="rtl" className="font-semibold">{residentName}</dd>
            <dt className="text-muted">{M.template}</dt><dd dir="ltr" className="text-start text-sm">{preview.template}</dd>
          </dl>
          {preview.editable ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-muted">{M.yourText}</span>
              <textarea dir="rtl" rows={4} value={value} onChange={(e) => setEdit({ text: preview.text, value: e.target.value })} className="w-full rounded-xl border border-[#D8DEE8] bg-white p-3 text-base outline-none focus:border-navy/40 focus:ring-4 focus:ring-navy/10" />
            </label>
          ) : (
            <>
              <p dir="rtl" className="rounded-xl bg-[#F4F6FA] p-3 text-base">{preview.text}</p>
              <p role="note" className="text-sm text-[#7A4A00]">{M.locked}</p>
            </>
          )}
          {preview.buttons && (
            <div className="flex gap-2" aria-hidden="true">
              {preview.buttons.map((b) => <span key={b.id} className="flex h-10 flex-1 items-center justify-center rounded-xl border border-line text-sm font-semibold text-navy">{b.title}</span>)}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
