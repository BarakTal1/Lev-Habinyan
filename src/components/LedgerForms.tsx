"use client";
import { useRef, useState, useTransition } from "react";
import { Field, inputCls } from "./Field";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { addSpecialChargeAction, recordPaymentAction, setMonthlyFeeAction } from "@/app/(app)/buildings/actions";
import { formatILS } from "@/lib/domain/money";
import { t } from "@/lib/labels";

const L = t.ledger;
type Result = { error?: keyof typeof L.errors };
export type LedgerUnit = { unitId: string; unit: string; payerName: string | null; fee: number | null; balance: number; monthsOwed: number };

/** Runs a server action with the form's data and keeps its error. Calls onDone after a success. */
function useLedgerAction(run: (fd: FormData) => Promise<Result>, onDone?: () => void) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = (form: HTMLFormElement) => start(async () => {
    setError("");
    try {
      const r = await run(new FormData(form));
      if (r.error) setError(L.errors[r.error]);
      else onDone?.();
    } catch {
      setError(L.errors.failed);
    }
  });
  return { error, pending, submit };
}

function Balance({ agorot }: { agorot: number }) {
  if (agorot > 0) return <span className="font-bold text-[#B3261E]">{formatILS(agorot)}</span>;
  if (agorot < 0) return <span className="font-semibold text-[#1F7A47]">{L.credit} {formatILS(-agorot)}</span>;
  return <span className="font-semibold text-muted">{formatILS(0)}</span>;
}

/** Every apartment with its fee and balance. A tap opens the payment form for that apartment. */
export function UnitLedgerList({ buildingId, units, today }: { buildingId: string; units: LedgerUnit[]; today: string }) {
  const [sel, setSel] = useState<LedgerUnit | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { error, pending, submit } = useLedgerAction((fd) => recordPaymentAction(buildingId, sel!.unitId, fd), () => setSel(null));

  if (units.length === 0) return <p className="card p-6 text-center text-muted">{L.noUnits}</p>;
  return (
    <>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--card-shadow)]">
        {units.map((u) => (
          <button key={u.unitId} type="button" onClick={() => setSel(u)} className="press-row flex min-h-[64px] items-center gap-3 bg-white px-4 text-start">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{L.unit(u.unit)}</div>
              <div className="truncate text-sm text-muted">{u.payerName ?? L.noPayer}{u.fee !== null && <> · {L.fee} {formatILS(u.fee)}</>}</div>
            </div>
            <div className="flex flex-col items-end">
              <Balance agorot={u.balance} />
              {u.monthsOwed > 0 && <span className="text-[13px] text-[#B3261E]">{L.monthsOwed(u.monthsOwed)}</span>}
            </div>
          </button>
        ))}
      </div>
      <Sheet
        open={sel !== null}
        onClose={() => setSel(null)}
        title={sel ? L.payTitle(sel.unit) : ""}
        footer={<button type="button" disabled={pending} onClick={() => formRef.current && submit(formRef.current)} className="h-14 w-full rounded-2xl bg-navy text-[17px] font-bold text-white disabled:opacity-40">{L.record}</button>}
      >
        {sel && (
          <form ref={formRef} key={sel.unitId} onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="flex flex-col gap-3">
            <Field label={L.amount}><input name="amount" inputMode="decimal" dir="ltr" required defaultValue={sel.balance > 0 ? String(sel.balance / 100) : sel.fee ? String(sel.fee / 100) : ""} className={inputCls} /></Field>
            <Field label={L.paidAt}><input name="paidAt" type="date" dir="ltr" required defaultValue={today} className={inputCls} /></Field>
            <Field label={L.method}>
              <select name="method" defaultValue="transfer" className={inputCls}>
                {(Object.keys(L.methods) as (keyof typeof L.methods)[]).map((m) => <option key={m} value={m}>{L.methods[m]}</option>)}
              </select>
            </Field>
            <Field label={L.forMonth}><input name="month" type="month" dir="ltr" className={inputCls} /></Field>
            <Field label={L.note}><input name="note" dir="rtl" className={inputCls} /></Field>
            {error && <p role="alert" className="text-[#B3261E]">{error}</p>}
          </form>
        )}
      </Sheet>
    </>
  );
}

function SubmitRow({ label, pending, error }: { label: string; pending: boolean; error: string }) {
  return (
    <>
      {error && <p role="alert" className="text-[#B3261E]">{error}</p>}
      <button disabled={pending} className="h-12 rounded-xl bg-navy font-semibold text-white disabled:opacity-40">{label}</button>
    </>
  );
}

const monthValue = (iso: string) => iso.slice(0, 7);

/** Sets the monthly fee for one apartment or for all of them, for a range of months. */
export function FeeForm({ buildingId, units, today }: { buildingId: string; units: { unitId: string; unit: string }[]; today: string }) {
  const [done, setDone] = useState(false);
  const { error, pending, submit } = useLedgerAction((fd) => setMonthlyFeeAction(buildingId, fd), () => setDone(true));
  return (
    <details className="card p-4">
      <summary className="flex h-10 cursor-pointer items-center gap-1 font-semibold text-navy"><Icon name="payments" size={20} />{L.setFee}</summary>
      <form onSubmit={(e) => { e.preventDefault(); setDone(false); submit(e.currentTarget); }} className="mt-3 flex flex-col gap-3">
        <Field label={t.buildings.unit}>
          <select name="unit" defaultValue="all" className={inputCls}>
            <option value="all">{L.allUnits}</option>
            {units.map((u) => <option key={u.unitId} value={u.unitId}>{L.unit(u.unit)}</option>)}
          </select>
        </Field>
        <Field label={L.feeAmount}><input name="amount" inputMode="decimal" dir="ltr" required className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={L.fromMonth}><input name="from" type="month" dir="ltr" required defaultValue={monthValue(today)} className={inputCls} /></Field>
          <Field label={L.toMonth}><input name="to" type="month" dir="ltr" required defaultValue={`${today.slice(0, 4)}-12`} className={inputCls} /></Field>
        </div>
        <SubmitRow label={L.saveFee} pending={pending} error={error} />
        {done && <p role="status" className="text-[#1F7A47]">{L.saved}</p>}
      </form>
    </details>
  );
}

/** A one-time charge (for example a lobby renovation) for the chosen apartments. */
export function ChargeForm({ buildingId, units }: { buildingId: string; units: { unitId: string; unit: string }[] }) {
  const [done, setDone] = useState(false);
  const { error, pending, submit } = useLedgerAction((fd) => addSpecialChargeAction(buildingId, fd), () => setDone(true));
  return (
    <details className="card p-4">
      <summary className="flex h-10 cursor-pointer items-center gap-1 font-semibold text-navy"><Icon name="receipt_long" size={20} />{L.charge}</summary>
      <form onSubmit={(e) => { e.preventDefault(); setDone(false); submit(e.currentTarget); }} className="mt-3 flex flex-col gap-3">
        <Field label={L.chargeName}><input name="name" dir="rtl" required className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={L.dueDate}><input name="due" type="date" dir="ltr" required className={inputCls} /></Field>
          <Field label={L.chargeAmount}><input name="amount" inputMode="decimal" dir="ltr" required className={inputCls} /></Field>
        </div>
        <Field label={L.chargeUnits} group>
          <div className="flex flex-wrap gap-2">
            {units.map((u) => (
              <label key={u.unitId} className="flex h-10 items-center gap-2 rounded-full border border-line px-3">
                <input type="checkbox" name="units" value={u.unitId} defaultChecked className="h-4 w-4" />{L.unit(u.unit)}
              </label>
            ))}
          </div>
        </Field>
        <SubmitRow label={L.saveCharge} pending={pending} error={error} />
        {done && <p role="status" className="text-[#1F7A47]">{L.saved}</p>}
      </form>
    </details>
  );
}
