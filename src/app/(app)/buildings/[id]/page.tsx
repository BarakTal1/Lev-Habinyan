import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Field, inputCls } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { LtrText } from "@/components/LtrText";
import { Plaque } from "@/components/Plaque";
import { Row } from "@/components/Row";
import { StatCard } from "@/components/StatCard";
import { getBuilding } from "@/lib/db/buildings";
import { loadBuildingMaintenance } from "@/lib/db/maintenance";
import { listTickets } from "@/lib/db/tickets";
import { ageLabel } from "@/lib/format";
import { formatDate } from "@/lib/israel";
import { MAINT_LABEL, t } from "@/lib/labels";
import { telLink, waLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditBuildingSheet } from "@/components/EditBuildingSheet";
import { ChargeForm, FeeForm, UnitLedgerList } from "@/components/LedgerForms";
import { PersonEditSheet, UnitEditSheet } from "@/components/TenantSheets";
import { loadLedger } from "@/lib/db/ledger";
import { formatILS } from "@/lib/domain/money";
import { todayIL } from "@/lib/israel";
import { addResidentAction, archiveResidentAction, uploadBuildingDocumentAction } from "../actions";

const TABS = ["overview", "payments", "residents", "suppliers", "maintenance", "documents"] as const;
type Tab = (typeof TABS)[number];
const card = "card p-4";
const list = "flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--card-shadow)]";
const iconBtn = "flex h-12 w-12 items-center justify-center rounded-[14px]";
const OPEN_ROWS = 5;
const MAINT_ROWS = 4;

export default async function BuildingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const db = await createClient();
  const b = await getBuilding(db, id);
  if (!b) notFound();

  // The overview needs the open tickets and the maintenance dates. The other tabs do not.
  const [open, maint] = tab === "overview"
    ? await Promise.all([listTickets(db, { building: id }, null), loadBuildingMaintenance(db, id)])
    : [[], []];
  const now = new Date();
  const today = todayIL(now);
  // The payments tab needs the ledger and this month's fee for each apartment.
  const ledger = tab === "payments" ? await loadLedger(db, { buildingId: id, today }) : null;
  const fees = ledger && ledger.rows.length
    ? new Map((await db.from("tariff").select("unit_id, amount_agorot").eq("month", today.slice(0, 8) + "01").in("unit_id", ledger.rows.map((r) => r.unitId))).data?.map((f) => [f.unit_id, f.amount_agorot]) ?? [])
    : new Map<string, number>();
  const overdueMaint = maint.filter((m) => m.state === "overdue").length;
  const nextMaint = maint
    .filter((m) => m.applicable && m.next_due_at)
    .sort((x, y) => (x.next_due_at ?? "").localeCompare(y.next_due_at ?? ""))
    .slice(0, MAINT_ROWS);

  return (
    <main className="mx-auto max-w-[1280px]">
      <div className="px-4 pt-3 lg:px-8 lg:pt-6">
        <Link href="/buildings" className="press inline-flex h-10 items-center gap-1 text-[15px] font-semibold text-brand"><Icon name="arrow_forward" size={20} />{t.buildings.title}</Link>
      </div>
      <header className="flex flex-wrap items-center gap-4 px-5 pb-4 pt-2 lg:px-8">
        <Plaque name={b.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 dir="rtl" className="text-[26px] font-bold leading-tight lg:text-[30px]">{b.name}</h1>
          <p className="text-[15px] text-muted">{[b.city, b.address].filter(Boolean).join(" · ") || " "}</p>
        </div>
        <EditBuildingSheet building={{ id: b.id, name: b.name, city: b.city, address: b.address, notes: b.notes }} />
      </header>
      <nav className="no-scrollbar mx-4 flex gap-1 overflow-x-auto border-b border-line lg:mx-8" aria-label="tabs">
        {TABS.map((k) => (
          <Link key={k} href={`/buildings/${id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={`relative flex h-11 items-center whitespace-nowrap px-3 text-[15px] ${tab === k ? "font-semibold text-brand" : "text-muted hover:text-ink"}`}>
            {t.buildings.tabs[k]}
            {tab === k && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand" />}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-4 px-4 pb-8 pt-5 lg:px-8">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard label={t.buildings.units} value={b.units} icon="apartment" />
              <StatCard label={t.buildings.residentsCount} value={b.residents.length} icon="groups" href={`/buildings/${id}?tab=residents`} />
              <StatCard label={t.buildings.openTickets} value={b.open_tickets} icon="confirmation_number" tone={b.open_tickets ? "warn" : "ok"} href={`/tickets?building=${id}`} />
              <StatCard label={t.buildings.overdueMaint} value={overdueMaint} icon="event_repeat" tone={overdueMaint ? "danger" : "ok"} href={`/maintenance/${id}`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <section>
                <div className="flex items-baseline gap-2 px-1 pb-2.5">
                  <h2 className="text-lg font-bold">{t.buildings.openTickets}</h2>
                  <span className="flex-1" />
                  <Link href={`/tickets?building=${id}`} className="text-sm font-semibold text-brand">{t.buildings.seeAll}</Link>
                </div>
                {open.length === 0 ? <p className="card p-6 text-center text-muted">{t.buildings.noOpen}</p> : (
                  <div className={list}>
                    {open.slice(0, OPEN_ROWS).map((r) => (
                      <Row key={r.id} kind={r.kind} title={r.title} building={null} meta={`${ageLabel(r.created_at, now)} · ${r.status}`} badge={{ list: "urgency", value: r.urgency }} href={`/tickets/${r.id}`} />
                    ))}
                  </div>
                )}
              </section>
              <section>
                <div className="flex items-baseline gap-2 px-1 pb-2.5">
                  <h2 className="text-lg font-bold">{t.buildings.nextMaint}</h2>
                  <span className="flex-1" />
                  <Link href={`/maintenance/${id}`} className="text-sm font-semibold text-brand">{t.buildings.seeAll}</Link>
                </div>
                {nextMaint.length === 0 ? <p className="card p-6 text-center text-muted">{t.buildings.noMaintDates}</p> : (
                  <div className={list}>
                    {nextMaint.map((m) => (
                      <Link key={m.id} href={`/maintenance/${id}`} className="press-row flex min-h-[60px] items-center gap-3 bg-white px-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{m.system}</div>
                          <div className="text-sm text-muted">{m.supplier_name ?? ""}</div>
                        </div>
                        <span className="text-sm" dir="ltr">{formatDate(m.next_due_at!)}</span>
                        {m.state !== "ok" && <Badge list="maint" value={MAINT_LABEL[m.state]} />}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
            {b.notes && (
              <section className={card}>
                <h2 className="pb-1 text-[15px] font-bold">{t.buildings.notes}</h2>
                <p dir="rtl" className="whitespace-pre-line">{b.notes}</p>
              </section>
            )}
          </>
        )}

        {tab === "payments" && ledger && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
              <StatCard label={t.ledger.debt} value={formatILS(ledger.totals.debt)} icon="payments" tone={ledger.totals.debt > 0 ? "danger" : "ok"} />
              <StatCard label={t.ledger.paidThisMonth} value={formatILS(ledger.totals.thisMonthPaid)} icon="receipt_long" hint={t.ledger.ofDue(formatILS(ledger.totals.thisMonthDue))} />
              <StatCard label={t.ledger.debtors} value={ledger.totals.debtors} icon="groups" tone={ledger.totals.debtors ? "warn" : "ok"} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <UnitLedgerList buildingId={id} today={today} units={ledger.rows.map((r) => ({ unitId: r.unitId, unit: r.unit, payerName: r.payerName, fee: fees.get(r.unitId) ?? null, balance: r.balance, monthsOwed: r.monthsOwed }))} />
              <div className="flex flex-col gap-4">
                <FeeForm buildingId={id} today={today} units={ledger.rows.map((r) => ({ unitId: r.unitId, unit: r.unit }))} />
                <ChargeForm buildingId={id} units={ledger.rows.map((r) => ({ unitId: r.unitId, unit: r.unit }))} />
              </div>
            </div>
          </>
        )}

        {tab === "residents" && (
          <div className="flex flex-col gap-4">
            <details className={`${card} max-w-3xl`}>
              <summary className="flex h-10 cursor-pointer items-center gap-1 font-semibold text-navy"><Icon name="person_add" size={20} />{t.buildings.addResident}</summary>
              <form action={addResidentAction.bind(null, id)} className="mt-3 flex flex-col gap-3">
                <Field label={t.buildings.resName}><input name="name" required dir="rtl" className={inputCls} /></Field>
                <Field label={t.buildings.phone}><input name="phone" type="tel" dir="ltr" className={inputCls} /></Field>
                <Field label={t.tenants.email}><input name="email" type="email" dir="ltr" className={inputCls} /></Field>
                <Field label={t.buildings.unit}><input name="unit" required dir="ltr" inputMode="numeric" className={inputCls} /></Field>
                <Field label={t.buildings.owner + " / " + t.buildings.tenant}>
                  <select name="relation" className={inputCls}><option value="owner">{t.buildings.owner}</option><option value="tenant">{t.buildings.tenant}</option></select>
                </Field>
                <label className="flex h-12 items-center gap-2"><input type="checkbox" name="committee" className="h-5 w-5" />{t.buildings.committee}</label>
                <button className="h-12 rounded-xl bg-navy font-semibold text-white">{t.common.save}</button>
              </form>
            </details>
            {b.apartments.length === 0 ? <p className="py-10 text-center text-muted">{t.buildings.noResidents}</p> : (
              <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                {b.apartments.map((a) => {
                  const people = b.residents.filter((r) => r.unit_id === a.id);
                  return (
                    <section key={a.id} aria-label={t.tenants.apartment(a.number)} className="card overflow-hidden">
                      <header className="flex items-center gap-2 border-b border-line bg-[#F8FAFC] py-2 pe-2 ps-4">
                        <h3 className="font-bold">{t.tenants.apartment(a.number)}</h3>
                        {a.floor && <span className="text-sm text-muted">· {t.tenants.floorShort(a.floor)}</span>}
                        {a.payer && <span className="rounded-md bg-brand-soft px-1.5 text-[13px] font-semibold text-brand">{t.tenants.payerShort(t.tenants.roles[a.payer])}</span>}
                        <span className="flex-1" />
                        <UnitEditSheet buildingId={id} unit={a} people={people} />
                      </header>
                      {people.length === 0 ? <p className="px-4 py-4 text-sm text-muted">{t.tenants.noPeople}</p> : (
                        <div className="flex flex-col divide-y divide-line">
                          {people.map((r) => (
                            <div key={r.person_id} className="flex min-h-[68px] items-center gap-1.5 py-2 pe-2 ps-4">
                              <div className="min-w-0 flex-1">
                                <div dir="rtl" className="flex flex-wrap items-center gap-1.5 text-base font-semibold">
                                  {r.name}
                                  {a.primary_contact_id === r.person_id && <span title={t.tenants.primary} className="text-[#E0A030]">★<span className="sr-only">{t.tenants.primary}</span></span>}
                                  <span className="rounded-md bg-[#EEF1F5] px-1.5 text-[13px] font-medium text-muted">{r.relation === "tenant" ? t.buildings.tenant : t.buildings.owner}</span>
                                  {r.is_committee && <span className="rounded-md bg-[#EAF1FC] px-1.5 text-[13px] text-navy">{t.buildings.committee}</span>}
                                  {!r.approved && <span className="rounded-md bg-[#FDF0DC] px-1.5 text-[13px] font-medium text-[#7A4A00]">{t.msg.pendingBadge}</span>}
                                </div>
                                <div className="truncate text-sm text-muted">{r.phone && <LtrText>{r.phone}</LtrText>}{r.phone && r.email && " · "}{r.email && <LtrText>{r.email}</LtrText>}</div>
                              </div>
                              {telLink(r.phone) && <a href={telLink(r.phone)!} aria-label={t.buildings.call} className={`${iconBtn} bg-[#EAF1FC] text-navy`}><Icon name="call" size={22} filled /></a>}
                              {waLink(r.phone) && <a href={waLink(r.phone)!} aria-label={t.buildings.chat} className={`${iconBtn} bg-[#E3F4EA] text-[#1E6B45]`}><Icon name="chat" size={22} /></a>}
                              <PersonEditSheet buildingId={id} person={r} />
                              <ConfirmForm action={archiveResidentAction.bind(null, id, r.person_id)} message={`${t.buildings.archiveConfirm} ${r.name}?`}><button aria-label={t.buildings.archive} className="press flex h-10 w-10 items-center justify-center rounded-xl text-muted"><Icon name="close" size={20} /></button></ConfirmForm>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "suppliers" && (b.suppliers.length === 0 ? <p className="py-10 text-center text-muted">{t.buildings.noSuppliers}</p> : (
          <div className={`${list} max-w-3xl`}>
            {b.suppliers.map((s) => (
              <div key={s.id} className="flex min-h-[68px] items-center gap-2 bg-white px-4">
                <div className="flex-1"><div dir="rtl" className="font-semibold">{s.name}</div><div className="text-sm text-muted">{s.category}</div></div>
                {telLink(s.phone) && <a href={telLink(s.phone)!} aria-label={t.buildings.call} className={`${iconBtn} bg-[#EAF1FC] text-navy`}><Icon name="call" size={22} filled /></a>}
              </div>
            ))}
          </div>
        ))}

        {tab === "maintenance" && (
          <section className={`${card} max-w-3xl`}><Link href={`/maintenance/${id}`} className="flex h-12 items-center justify-center rounded-xl bg-navy font-semibold text-white">{t.buildings.openMaintenance}</Link></section>
        )}

        {tab === "documents" && (
          <section className={`${card} flex max-w-3xl flex-col gap-3`}>
            {b.documents.length === 0 && <p className="text-muted">{t.buildings.noDocs}</p>}
            {b.documents.map((d) => d.url && <a key={d.id} href={d.url} className="flex h-12 items-center gap-2 text-navy underline"><Icon name="description" size={22} />{new Date(d.created_at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}</a>)}
            <form action={uploadBuildingDocumentAction.bind(null, id)} className="flex gap-2">
              <input type="file" name="file" required className="min-w-0 flex-1 text-sm" />
              <button className="h-12 rounded-xl border border-navy px-4 font-semibold text-navy">{t.buildings.addDoc}</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
