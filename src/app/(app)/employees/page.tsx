import { EmployeeManager } from "@/components/EmployeeManager";
import { listEmployees } from "@/lib/db/people";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeesPage() {
  const rows = await listEmployees(await createClient());
  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="px-1 pb-3 pt-2 text-[26px] font-bold">{t.people.employees}</h1>
      <EmployeeManager rows={rows} />
    </main>
  );
}
