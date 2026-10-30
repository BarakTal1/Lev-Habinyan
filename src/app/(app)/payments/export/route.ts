import { requireUser } from "@/lib/auth";
import { loadLedger } from "@/lib/db/ledger";
import { debtorsCsv } from "@/lib/domain/ledger";
import { todayIL } from "@/lib/israel";
import { createClient } from "@/lib/supabase/server";

/** The debtor list as a CSV file. Founders only. */
export async function GET(request: Request) {
  await requireUser();
  const building = new URL(request.url).searchParams.get("building") || undefined;
  const today = todayIL(new Date());
  const { rows } = await loadLedger(await createClient(), { buildingId: building, today });
  const debtors = rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  return new Response(debtorsCsv(debtors), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="debtors-${today}.csv"`, "cache-control": "no-store" },
  });
}
