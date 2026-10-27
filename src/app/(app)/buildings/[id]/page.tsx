import Link from "next/link";
import { notFound } from "next/navigation";
import { Field, inputCls } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { LtrText } from "@/components/LtrText";
import { getBuilding } from "@/lib/db/buildings";
import { t } from "@/lib/labels";
import { telLink, waLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditBuildingSheet } from "@/components/EditBuildingSheet";
import { addResidentAction, archiveResidentAction, uploadBuildingDocumentAction } from "../actions";

const TABS = ["overview", "residents", "suppliers", "maintenance", "documents"] as const;
type Tab = (typeof TABS)[number];
const card = "rounded-2xl bg-white p-4 border border-[var(--hairline)]";
const iconBtn = "flex h-12 w-12 items-center justify-center rounded-[14px]";

export default async function BuildingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const b = await getBuilding(await createClient(), id);
  if (!b) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/buildings" className="flex h-12 items-center text-navy"><Icon name="arrow_forward" size={22} /></Link>
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 dir="rtl" className="text-2xl font-bold">{b.name}</h1>
          <p className="text-muted">{[b.city, b.address].filter(Boolean).join(" · ")}</p>
        </div>
        <EditBuildingSheet building={{ id: b.id, name: b.name, city: b.city, address: b.address, notes: b.notes }} />
      </header>
      <nav className="flex gap-2 overflow-x-auto" aria-label="tabs">
        {TABS.map((k) => (
          <Link key={k} href={`/buildings/${id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={`flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[15px] ${tab === k ? "bg-navy font-semibold text-white" : "border border-[#DAD5CB] bg-white"}`}>
            {t.buildings.tabs[k]}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <section className={`${card} flex flex-col gap-3`}>
          <div className="flex justify-between"><span className="text-muted">{t.buildings.units}</span><b>{b.units}</b></div>
          <div className="flex justify-between"><span className="text-muted">{t.buildings.openTickets}</span><b>{b.open_tickets}</b></div>
          {b.notes && <p dir="rtl">{b.notes}</p>}
          <Link href={`/tickets?building=${id}`} className="flex h-12 items-center justify-center rounded-xl border border-navy font-semibold text-navy">{t.buildings.openList}</Link>
          <Link href={`/maintenance/${id}`} className="flex h-12 items-center justify-center rounded-xl border border-navy font-semibold text-navy">{t.buildings.openMaintenance}</Link>
        </section>
      )}

      {tab === "residents" && (
        <>
          <details className={card}>
            <summary className="flex h-10 cursor-pointer items-center gap-1 font-semibold text-navy"><Icon name="person_add" size={20} />{t.buildings.addResident}</summary>
            <form action={addResidentAction.bind(null, id)} className="mt-3 flex flex-col gap-3">
              <Field label={t.buildings.resName}><input name="name" required dir="rtl" className={inputCls} /></Field>
              <Field label={t.buildings.phone}><input name="phone" type="tel" dir="ltr" className={inputCls} /></Field>
              <Field label={t.buildings.unit}><input name="unit" required dir="ltr" inputMode="numeric" className={inputCls} /></Field>
              <Field label={t.buildings.owner + " / " + t.buildings.tenant}>
                <select name="relation" className={inputCls}><option value="owner">{t.buildings.owner}</option><option value="tenant">{t.buildings.tenant}</option></select>
              </Field>
              <label className="flex h-12 items-center gap-2"><input type="checkbox" name="committee" className="h-5 w-5" />{t.buildings.committee}</label>
              <button className="h-12 rounded-xl bg-navy font-semibold text-white">{t.common.save}</button>
            </form>
          </details>
          {b.residents.length === 0 ? <p className="py-10 text-center text-muted">{t.buildings.noResidents}</p> : (
            <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3]">
              {b.residents.map((r) => (
                <div key={r.person_id + r.unit_id} className="flex min-h-[72px] items-center gap-2 bg-white py-2 pe-3 ps-2">
                  <div className="min-w-0 flex-1 ps-2">
                    <div dir="rtl" className="text-base font-semibold">{r.name}{r.is_committee && <span className="ms-2 rounded-md bg-[#E3E8F2] px-1.5 text-[13px] text-navy">{t.buildings.committee}</span>}</div>
                    <div className="text-sm text-muted">{t.buildings.unit} <LtrText>{r.unit}</LtrText> · {r.relation === "tenant" ? t.buildings.tenant : t.buildings.owner}{r.phone && <> · <LtrText>{r.phone}</LtrText></>}</div>
                  </div>
                  {telLink(r.phone) && <a href={telLink(r.phone)!} aria-label={t.buildings.call} className={`${iconBtn} bg-[#E3E8F2] text-navy`}><Icon name="call" size={22} filled /></a>}
                  {waLink(r.phone) && <a href={waLink(r.phone)!} aria-label={t.buildings.chat} className={`${iconBtn} bg-[#E3F4EA] text-[#1E6B45]`}><Icon name="chat" size={22} /></a>}
                  <ConfirmForm action={archiveResidentAction.bind(null, id, r.person_id)} message={`${t.buildings.archiveConfirm} ${r.name}?`}><button aria-label={t.buildings.archive} className={`${iconBtn} text-muted`}><Icon name="close" size={20} /></button></ConfirmForm>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "suppliers" && (b.suppliers.length === 0 ? <p className="py-10 text-center text-muted">{t.buildings.noSuppliers}</p> : (
        <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#EFEBE3]">
          {b.suppliers.map((s) => (
            <div key={s.id} className="flex min-h-[68px] items-center gap-2 bg-white px-4">
              <div className="flex-1"><div dir="rtl" className="font-semibold">{s.name}</div><div className="text-sm text-muted">{s.category}</div></div>
              {telLink(s.phone) && <a href={telLink(s.phone)!} aria-label={t.buildings.call} className={`${iconBtn} bg-[#E3E8F2] text-navy`}><Icon name="call" size={22} filled /></a>}
            </div>
          ))}
        </div>
      ))}

      {tab === "maintenance" && (
        <section className={card}><Link href={`/maintenance/${id}`} className="flex h-12 items-center justify-center rounded-xl bg-navy font-semibold text-white">{t.buildings.openMaintenance}</Link></section>
      )}

      {tab === "documents" && (
        <section className={`${card} flex flex-col gap-3`}>
          {b.documents.length === 0 && <p className="text-muted">{t.buildings.noDocs}</p>}
          {b.documents.map((d) => d.url && <a key={d.id} href={d.url} className="flex h-12 items-center gap-2 text-navy underline"><Icon name="description" size={22} />{new Date(d.created_at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}</a>)}
          <form action={uploadBuildingDocumentAction.bind(null, id)} className="flex gap-2">
            <input type="file" name="file" required className="min-w-0 flex-1 text-sm" />
            <button className="h-12 rounded-xl border border-navy px-4 font-semibold text-navy">{t.buildings.addDoc}</button>
          </form>
        </section>
      )}
    </main>
  );
}
