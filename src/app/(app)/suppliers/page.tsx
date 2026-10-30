import { SupplierManager } from "@/components/SupplierManager";
import { Page } from "@/components/PageHeader";
import { listSuppliers } from "@/lib/db/people";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export default async function SuppliersPage() {
  const groups = await listSuppliers(await createClient());
  return (
    <Page title={t.people.suppliers} width="medium">
      <SupplierManager groups={groups} />
    </Page>
  );
}
