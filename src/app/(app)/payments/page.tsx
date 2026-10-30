import Link from "next/link";
import { inputCls } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { requireUser } from "@/lib/auth";
import { loadLedger, loadUnmatched } from "@/lib/db/ledger";
import { listBuildings } from "@/lib/db/people";
import { formatILS } from "@/lib/domain/money";
import { formatDate, todayIL } from "@/lib/israel";
import { t } from "@/lib/labels";
import { telLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { linkPaymentAction } from "./actions";

const L = t.ledger;
const list = "flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--card-shadow)]";
const monthLabel = (iso: string | null) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ building?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const building = sp.building || undefined;
  const db = await createClient();
  const today = todayIL(new Date());
  const [ledger, unmatched, buildings] = await Promise.all([loadLedger(db, { buildingId: building, today }), loadUnmatched(db, building), listBuildings(db)]);
  const debtors = ledger.rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);

  // Apartments to choose from, for each building that has an unmatched payment.
  const unitBuildings = [...new Set(unmatched.map((u) => u.buildingId))];
  const units = unitBuildings.length
    ? (await db.from("unit").select("id, number, building_id").in("building_id", unitBuildings).is("archived_at", null).order("number")).data ?? []
    : [];

  return (
    <Page title={L.title}>
      <div className="grid grid-cols-2 gap-3 pb-5 lg:grid-cols-4 lg:gap-4">
        <StatCard label={L.totalDebt} value={formatILS(ledger.totals.debt)} icon="payments" tone={ledger.totals.debt > 0 ? "danger" : "ok"} />
        <StatCard label={L.debtors} value={ledger.totals.debtors} icon="groups" tone={ledger.totals.debtors ? "warn" : "ok"} />
        <StatCard label={L.collected} value={formatILS(ledger.totals.thisMonthPaid)} icon="receipt_long" />
        <StatCard label={L.expected} value={formatILS(ledger.totals.thisMonthDue)} icon="event" />
      </div>

      <div className="flex flex-wrap items-end gap-3 pb-4">
        <form action="/payments" className="flex flex-1 gap-2">
          <select name="building" defaultValue={building ?? ""} aria-label={t.ledgerImport.building} className={`${inputCls} max-w-xs`}>
            <option value="">{L.allBuildings}</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="h-12 rounded-xl border border-navy px-4 font-semibold text-navy">{L.show}</button>
        </form>
        <Link href={`/payments/export${building ? `?building=${building}` : ""}`} prefetch={false} className="inline-flex h-12 items-center gap-1 rounded-xl border border-line bg-white px-4 font-semibold text-navy">
          <Icon name="upload_file" size={20} />{L.export}
        </Link>
      </div>

      {debtors.length === 0 ? <p className="card p-6 text-center text-muted">{L.noDebtors}</p> : (
        <ul className={list}>
          <li aria-hidden="true" className="hidden h-10 items-center gap-3 bg-[#F8FAFC] px-4 text-[13px] font-semibold text-muted lg:flex">
            <span className="w-40 flex-none">{L.cols.building}</span>
            <span className="w-16 flex-none">{L.cols.unit}</span>
            <span className="flex-1">{L.cols.payer}</span>
            <span className="w-24 flex-none">{L.cols.months}</span>
            <span className="w-24 flex-none">{L.cols.since}</span>
            <span className="w-28 flex-none">{L.cols.lastPaid}</span>
            <span className="w-24 flex-none text-end">{L.cols.balance}</span>
          </li>
          {debtors.map((r) => (
            <li key={r.unitId} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white px-4 py-3 lg:flex-nowrap">
              <Link href={`/buildings/${r.buildingId}?tab=payments`} className="w-full font-semibold text-brand lg:w-40 lg:flex-none">{r.buildingName}</Link>
              <span className="font-semibold lg:w-16 lg:flex-none">{L.unit(r.unit)}</span>
              <span className="min-w-0 flex-1 text-sm lg:text-base">
                {r.payerName ?? L.noPayer}
                {r.payerPhone && telLink(r.payerPhone) && <> · <a href={telLink(r.payerPhone)!} className="text-brand" dir="ltr">{r.payerPhone}</a></>}
              </span>
              <span className="text-sm text-[#B3261E] lg:w-24 lg:flex-none">{L.monthsOwed(r.monthsOwed)}</span>
              <span className="hidden text-sm lg:block lg:w-24 lg:flex-none" dir="ltr">{monthLabel(r.oldestOpen)}</span>
              <span className="hidden text-sm lg:block lg:w-28 lg:flex-none" dir="ltr">{r.lastPaidAt ? formatDate(r.lastPaidAt) : ""}</span>
              <span className="ms-auto font-bold text-[#B3261E] lg:w-24 lg:flex-none lg:text-end">{formatILS(r.balance)}</span>
            </li>
          ))}
        </ul>
      )}

      {unmatched.length > 0 && (
        <section className="pt-6">
          <h2 className="px-1 pb-1 text-lg font-bold">{L.unmatchedTitle}</h2>
          <p className="px-1 pb-2.5 text-sm text-muted">{L.unmatchedHelp}</p>
          <ul className={list}>
            {unmatched.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.buildingName} · {formatILS(p.amount)}</div>
                  <div className="text-sm text-muted"><span dir="ltr">{formatDate(p.paidAt)}</span> · {L.rawUnit}: {p.rawUnit}</div>
                </div>
                <form action={linkPaymentAction.bind(null, p.id)} className="flex gap-2">
                  <select name="unit" required defaultValue="" aria-label={L.pickUnit} className={`${inputCls} w-36`}>
                    <option value="" disabled>{L.pickUnit}</option>
                    {units.filter((u) => u.building_id === p.buildingId).map((u) => <option key={u.id} value={u.id}>{L.unit(u.number)}</option>)}
                  </select>
                  <button className="h-12 rounded-xl bg-navy px-4 font-semibold text-white">{L.link}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
