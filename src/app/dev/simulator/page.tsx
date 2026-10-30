import { notFound, redirect } from "next/navigation";
import { SimulatorChat } from "@/components/SimulatorChat";
import { simulatorLoadAction } from "./actions";
import { requireUser } from "@/lib/auth";
import { newSimulatorPhone } from "@/lib/bot/simulatorPhone";
import { devLoginEnabled } from "@/lib/devLogin";
import { t } from "@/lib/labels";

/** Development only. A page where a developer writes to the bot as a resident. It is a 404 on Vercel and when the dev sign-in is off. */
export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  if (!devLoginEnabled()) notFound();
  await requireUser();
  const { phone } = await searchParams;
  if (!phone) redirect(`/dev/simulator?phone=${newSimulatorPhone()}`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4">
      <header>
        <h1 className="text-[22px] font-bold">{t.sim.title}</h1>
        <p className="text-sm text-muted">{t.sim.devOnly}</p>
      </header>
      <SimulatorChat phone={phone} initial={await simulatorLoadAction(phone)} />
    </main>
  );
}
