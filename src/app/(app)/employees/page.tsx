import { EmployeeManager } from "@/components/EmployeeManager";
import { Page } from "@/components/PageHeader";
import { listEmployees } from "@/lib/db/people";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeesPage() {
  const rows = await listEmployees(await createClient());
  return (
    <Page title={t.people.employees} sub={`${rows.length} ${t.people.employees}`} width="medium">
      <EmployeeManager rows={rows} />
    </Page>
  );
}
