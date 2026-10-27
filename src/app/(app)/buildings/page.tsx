import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { Field, inputCls } from "@/components/Field";
import { listBuildingCards } from "@/lib/db/buildings";
import { MAINT_LABEL, t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { createBuildingAction } from "./actions";

const STATE_TO_LABEL = MAINT_LABEL;

export default async function BuildingsPage() {
  const cards = await listBuildingCards(await createClient());
  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="px-1 pb-3 pt-2 text-[26px] font-bold">{t.buildings.title}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.id} href={`/buildings/${c.id}`} className="flex flex-col gap-2 rounded-2xl bg-white p-4 border border-[var(--hairline)]">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div dir="rtl" className="text-[17px] font-bold">{c.name}</div>
                <div className="text-sm text-muted">{c.city}{c.city && " · "}{c.units} {t.buildings.units}</div>
              </div>
              <Icon name="chevron_left" size={22} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{t.buildings.openTickets}: {c.open_tickets}</span>
              <Badge list="maint" value={STATE_TO_LABEL[c.worst]} label={c.worst === "ok" ? t.buildings.allFine : c.worst === "nodata" ? t.buildings.noDataSystems(c.worst_count) : `${c.worst_count} ${STATE_TO_LABEL[c.worst]}`} />
            </div>
          </Link>
        ))}
      </div>
      <details className="mt-4 rounded-2xl bg-white p-4">
        <summary className="flex h-10 cursor-pointer items-center gap-1 font-semibold text-navy"><Icon name="add" size={20} />{t.buildings.add}</summary>
        <form action={createBuildingAction} className="mt-3 flex flex-col gap-3">
          <Field label={t.buildings.name}><input name="name" required dir="rtl" className={inputCls} /></Field>
          <Field label={t.buildings.city}><input name="city" dir="rtl" className={inputCls} /></Field>
          <Field label={t.buildings.address}><input name="address" dir="rtl" className={inputCls} /></Field>
          <button className="h-12 rounded-xl bg-navy font-semibold text-white">{t.common.save}</button>
        </form>
      </details>
    </main>
  );
}
