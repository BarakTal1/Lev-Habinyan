import { Page } from "@/components/PageHeader";
import { notFound } from "next/navigation";
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
    <Page title={t.maint.title} sub={<span dir="rtl">{b.data.name}</span>} back={{ href: "/maintenance", label: t.maint.title }} width="medium">
      <MaintBuilding buildingId={buildingId} rows={rows} suppliers={suppliers} today={todayIL(new Date())} />
    </Page>
  );
}
