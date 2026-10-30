import Link from "next/link";
import { ImportWizard } from "@/components/ImportWizard";
import { LedgerImport } from "@/components/LedgerImport";
import { Page } from "@/components/PageHeader";
import { listBuildings } from "@/lib/db/people";
import { todayIL } from "@/lib/israel";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["maintenance", "tariffs", "payments"] as const;
type Kind = (typeof KINDS)[number];

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const kind: Kind = (KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as Kind) : "maintenance";
  const buildings = kind === "maintenance" ? [] : await listBuildings(await createClient());
  return (
    <Page title={t.import.title} width="narrow">
      <nav aria-label={t.ledgerImport.kindNav} className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {KINDS.map((k) => (
          <Link key={k} href={`/import?kind=${k}`} aria-current={kind === k ? "page" : undefined}
            className={`relative flex h-11 items-center whitespace-nowrap px-3 text-[15px] ${kind === k ? "font-semibold text-brand" : "text-muted hover:text-ink"}`}>
            {t.ledgerImport.kinds[k]}
            {kind === k && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand" />}
          </Link>
        ))}
      </nav>
      {kind === "maintenance"
        ? <ImportWizard />
        : <LedgerImport key={kind} kind={kind} buildings={buildings} year={Number(todayIL(new Date()).slice(0, 4))} />}
    </Page>
  );
}
