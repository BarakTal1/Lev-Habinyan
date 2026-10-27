import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ScrollCue } from "@/components/ScrollCue";
import { loadPortfolio } from "@/lib/db/maintenance";
import { MAINT_LABEL, SYSTEMS, t } from "@/lib/labels";
import { badge } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";

const SHORT = ["ניקיון", "גינון", "מעלית", "כיבוי אש", "הדברה", "חשמל", "אינסטלציה", "ביוב", "גג", "משאבות", "מים", "שער"];
const ICON = { ok: "check_circle", soon: "schedule", overdue: "error", nodata: "help", na: "remove" } as const;

export default async function PortfolioPage() {
  const rows = await loadPortfolio(await createClient());
  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="px-1 pb-1 pt-2 text-[26px] font-bold">{t.maint.title}</h1>
      <p className="px-1 pb-3 text-muted">{t.maint.portfolio}</p>
      <div className="mb-3 flex flex-wrap gap-2 px-1 text-sm">
        {(Object.keys(MAINT_LABEL) as (keyof typeof MAINT_LABEL)[]).map((k) => {
          const b = badge("maint", MAINT_LABEL[k]);
          return <span key={k} className="inline-flex items-center gap-1" style={{ color: b.fg }}>{k === "nodata" ? <span aria-hidden="true" className="h-2 w-2 rounded-full border border-[#AEB3BE]" /> : <Icon name={ICON[k]} size={16} filled />}{MAINT_LABEL[k]}</span>;
        })}
      </div>
      {rows.length === 0 ? <p className="py-10 text-center text-muted">{t.maint.noBuildings}</p> : (
        <ScrollCue hint={t.maint.scrollHint} className="overflow-x-auto rounded-2xl bg-white border border-[var(--hairline)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky start-0 bg-white p-3 text-start font-semibold">{t.buildings.title}</th>
                {SHORT.map((s, i) => <th key={SYSTEMS[i]} className="p-2 text-center text-[12px] font-semibold text-muted" title={SYSTEMS[i]}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#F3F0EA]">
                  <th className="sticky start-0 bg-white p-3 text-start"><Link href={`/maintenance/${r.id}`} dir="rtl" className="font-semibold text-navy">{r.name}</Link></th>
                  {r.cells.map((c) => {
                    const b = badge("maint", MAINT_LABEL[c.state]);
                    return (
                      <td key={c.system} className="p-1 text-center">
                        <Link href={`/maintenance/${r.id}`} aria-label={`${c.system}: ${MAINT_LABEL[c.state]}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={c.state === "nodata" ? { color: b.fg } : { backgroundColor: b.bg, color: b.fg }}>
                          {c.state === "nodata" ? <span aria-hidden="true" className="h-2 w-2 rounded-full border border-[#AEB3BE]" /> : <Icon name={ICON[c.state]} size={18} filled />}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollCue>
      )}
    </main>
  );
}
