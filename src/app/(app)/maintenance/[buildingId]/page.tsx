import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MaintBuilding } from "@/components/MaintBuilding";
import { listAssignees } from "@/lib/db/people";
import { ensureItems, loadBuildingMaintenance } from "@/lib/db/maintenance";
import { todayIL } from "@/lib/israel";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export default async function BuildingMaintenancePage({ params }: { params: Promise<{ buildingId: string }> }) {
  const { buildingId } = await params;
  const db = await createClient();
  const b = await db.from("building").select("id, name").eq("id", buildingId).is("archived_at", null).maybeSingle();
  if (!b.data) notFound();
  let rows = await loadBuildingMaintenance(db, buildingId);
  if (rows.length === 0) {
    await ensureItems(db, buildingId);
    rows = await loadBuildingMaintenance(db, buildingId);
  }
  const people = await listAssignees(db);
  const suppliers = people.filter((p) => p.role === "supplier");
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Link href="/maintenance" className="flex h-12 items-center text-navy"><Icon name="arrow_forward" size={22} /></Link>
      <header>
        <h1 className="text-2xl font-bold">{t.maint.title}</h1>
        <p dir="auto" className="text-muted">{b.data.name}</p>
      </header>
      <MaintBuilding buildingId={buildingId} rows={rows} suppliers={suppliers} today={todayIL(new Date())} />
    </main>
  );
}
