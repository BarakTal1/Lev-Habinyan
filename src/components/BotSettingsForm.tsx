"use client";
import { useState, useTransition } from "react";
import { saveBotSettingsAction } from "@/app/(app)/people-actions";
import type { BotSettings } from "@/lib/bot/settings";
import { t } from "@/lib/labels";
import { Field, inputCls } from "./Field";

const B = t.botSettings;

/** Working hours, the emergency number and the on-call phones of the bot. */
export function BotSettingsForm({ initial, fallbackPhones = [] }: { initial: BotSettings; fallbackPhones?: string[] }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const hours = initial.hours;
  return (
    <form
      action={(fd) => start(async () => {
        setError(""); setSaved(false);
        const r = await saveBotSettingsAction(fd);
        if (r.error) setError(B.errors[r.error]); else setSaved(true);
      })}
      className="flex flex-col gap-3"
    >
      <Field label={B.days} group>
        <div className="flex flex-wrap gap-2">
          {B.dayNames.map((name, d) => (
            <label key={d} className="flex h-10 items-center gap-2 rounded-full border border-line px-3">
              <input type="checkbox" name="days" value={d} defaultChecked={hours?.days.includes(d) ?? false} className="h-4 w-4" />{name}
            </label>
          ))}
        </div>
        <span className="text-sm text-muted">{B.noDays}</span>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={B.from}><input type="time" name="from" dir="ltr" defaultValue={hours?.from ?? "08:00"} className={inputCls} /></Field>
        <Field label={B.to}><input type="time" name="to" dir="ltr" defaultValue={hours?.to ?? "18:00"} className={inputCls} /></Field>
      </div>
      <Field label={B.emergency}>
        <input name="emergency" inputMode="tel" dir="ltr" defaultValue={initial.emergencyNumber ?? ""} className={inputCls} />
        <span className="text-sm text-muted">{B.emergencyHelp}</span>
      </Field>
      <Field label={B.oncall}>
        <textarea name="oncall" dir="ltr" rows={3} defaultValue={initial.oncallPhones.join("\n")} placeholder={fallbackPhones.join("\n")} className={`${inputCls} h-auto py-2`} />
        <span className="text-sm text-muted">{B.oncallHelp}</span>
      </Field>
      {error && <p role="alert" className="text-[#B3261E]">{error}</p>}
      {saved && <p role="status" className="text-[#1F7A47]">{B.saved}</p>}
      <button disabled={pending} className="h-12 self-start rounded-xl border border-navy px-6 font-semibold text-navy disabled:opacity-50">{B.save}</button>
    </form>
  );
}
