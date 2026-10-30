// Balance of each apartment, from raw charges and payments. The database stores facts; this file decides who owes what.

export type Method = "card" | "transfer" | "check" | "cash" | "standing_order" | "other";

export type LedgerCharge = { unitId: string; due: string; amount: number; label: string };
export type LedgerPayment = { unitId: string; amount: number; paidAt: string; month: string | null };
export type UnitLedger = {
  unitId: string;
  /** Charges whose due date has passed. */
  due: number;
  paid: number;
  /** due - paid. Negative means the apartment has credit. */
  balance: number;
  /** Due charges that are not fully paid. */
  monthsOwed: number;
  oldestOpen: string | null;
  lastPaidAt: string | null;
};

/** One charge per tariff row, due on the first day of its month. */
export function tariffCharges(rows: { unit_id: string; month: string; amount_agorot: number }[]): LedgerCharge[] {
  return rows.map((r) => ({ unitId: r.unit_id, due: r.month, amount: r.amount_agorot, label: `${r.month.slice(5, 7)}/${r.month.slice(0, 4)}` }));
}

function unitLedger(unitId: string, charges: LedgerCharge[], payments: LedgerPayment[], today: string): UnitLedger {
  const due = charges.filter((c) => c.due <= today).sort((a, b) => a.due.localeCompare(b.due));
  const open = due.map((c) => c.amount);
  const future = new Set(charges.filter((c) => c.due > today).map((c) => c.due));

  // A payment that names a due month pays that month first; the rest joins the pool.
  // A payment for a month that is not yet due waits for it. Refunds and untagged payments go to the pool.
  let pool = 0;
  for (const p of payments) {
    if (p.amount > 0 && p.month) {
      if (future.has(p.month)) continue;
      const i = due.findIndex((c) => c.due === p.month);
      if (i >= 0) {
        const used = Math.min(open[i], p.amount);
        open[i] -= used;
        pool += p.amount - used;
        continue;
      }
    }
    pool += p.amount;
  }
  // The pool pays the oldest open charges first.
  for (let i = 0; i < open.length && pool > 0; i++) {
    const used = Math.min(open[i], pool);
    open[i] -= used;
    pool -= used;
  }

  const dueTotal = due.reduce((s, c) => s + c.amount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  // The open amounts must add up to the debt. A payment held for a future month leaves too much open:
  // close the newest open months first. A refund leaves too little open: reopen the newest paid months first.
  const target = Math.max(dueTotal - paid, 0);
  let gap = open.reduce((s, x) => s + x, 0) - target;
  for (let i = open.length - 1; i >= 0 && gap !== 0; i--) {
    const step = gap > 0 ? Math.min(open[i], gap) : -Math.min(due[i].amount - open[i], -gap);
    open[i] -= step;
    gap -= step;
  }
  const firstOpen = open.findIndex((x) => x > 0);
  const positive = payments.filter((p) => p.amount > 0).map((p) => p.paidAt).sort();
  return {
    unitId,
    due: dueTotal,
    paid,
    balance: dueTotal - paid,
    monthsOwed: open.filter((x) => x > 0).length,
    oldestOpen: firstOpen >= 0 ? due[firstOpen].due : null,
    lastPaidAt: positive.at(-1) ?? null,
  };
}

/** The ledger of every apartment that has a charge or a payment. `today` is the Israel date, YYYY-MM-DD. */
export function buildLedger(charges: LedgerCharge[], payments: LedgerPayment[], today: string): Map<string, UnitLedger> {
  const byUnit = new Map<string, { c: LedgerCharge[]; p: LedgerPayment[] }>();
  const slot = (id: string) => byUnit.get(id) ?? byUnit.set(id, { c: [], p: [] }).get(id)!;
  for (const c of charges) slot(c.unitId).c.push(c);
  for (const p of payments) slot(p.unitId).p.push(p);
  const out = new Map<string, UnitLedger>();
  for (const [id, { c, p }] of byUnit) out.set(id, unitLedger(id, c, p, today));
  return out;
}

export type DebtorCsvRow = {
  buildingName: string; unit: string; payerName: string | null; payerPhone: string | null;
  balance: number; monthsOwed: number; oldestOpen: string | null; lastPaidAt: string | null;
};

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const dmy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** The debtor list as CSV for Excel: a byte order mark for Hebrew, the balance as a plain number in shekels. */
export function debtorsCsv(rows: DebtorCsvRow[]): string {
  const header = ["בניין", "דירה", "משלם", "טלפון", "יתרה (₪)", "חודשים בחוב", "חוב מחודש", "תשלום אחרון"];
  const lines = rows.map((r) => [
    r.buildingName, r.unit, r.payerName ?? "", r.payerPhone ?? "", (r.balance / 100).toFixed(2), String(r.monthsOwed),
    r.oldestOpen ? `${r.oldestOpen.slice(5, 7)}/${r.oldestOpen.slice(0, 4)}` : "", dmy(r.lastPaidAt),
  ].map(csvCell).join(","));
  return "﻿" + [header.join(","), ...lines].join("\n") + "\n";
}
