"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { linkPayment } from "@/lib/db/ledger";
import { createClient } from "@/lib/supabase/server";

/** Links an unmatched payment to the apartment the founder chose. */
export async function linkPaymentAction(paymentId: string, formData: FormData): Promise<void> {
  await requireUser();
  const unitId = String(formData.get("unit") ?? "");
  if (!unitId) return;
  await linkPayment(await createClient(), paymentId, unitId);
  revalidatePath("/payments");
  revalidatePath("/");
}
