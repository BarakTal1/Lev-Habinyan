import { BotSettingsForm } from "@/components/BotSettingsForm";
import { getSettings } from "@/lib/bot/db";
import { getSetting } from "@/lib/db/people";
import { Page } from "@/components/PageHeader";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { demoModeEnabled } from "@/lib/demo";
import { setEmailRemindersAction } from "../people-actions";

export default async function SettingsPage() {
  const db = await createClient();
  const [on, bot, storedOncall, profiles] = await Promise.all([
    getSetting(db, "email_reminders", false),
    getSettings(db),
    getSetting<string[] | null>(db, "oncall_phones", null),
    db.from("profile").select("id, email, person:person_id(name)").order("email"),
  ]);
  const card = "flex flex-col gap-3 card p-4";
  return (
    <Page title={t.settings.title} width="narrow" className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="text-[17px] font-bold">{t.settings.founders}</h2>
        {(profiles.data ?? []).map((p) => (
          <div key={p.id} className="flex flex-col">
            <span dir="rtl" className="font-semibold">{(p.person as unknown as { name: string } | null)?.name ?? "—"}</span>
            <span dir="ltr" className="text-start text-sm text-muted">{p.email}</span>
          </div>
        ))}
      </section>
      <section className={card}>
        <h2 className="text-[17px] font-bold">{t.settings.emailReminders}</h2>
        <p className="text-sm text-muted">{t.settings.emailHelp}</p>
        <form action={setEmailRemindersAction} className="flex items-center gap-3">
          <label className="flex h-12 flex-1 items-center gap-2"><input type="checkbox" name="on" defaultChecked={on} className="h-5 w-5" />{t.settings.emailReminders}</label>
          <button className="h-12 rounded-xl border border-navy px-5 font-semibold text-navy">{t.common.save}</button>
        </form>
      </section>
      <section className={card}>
        <h2 className="text-[17px] font-bold">{t.botSettings.title}</h2>
        <p className="text-sm text-muted">{t.botSettings.help}</p>
        <BotSettingsForm initial={{ hours: bot.hours, emergencyNumber: bot.emergencyNumber, oncallPhones: storedOncall ?? [] }} fallbackPhones={bot.oncallPhones} />
      </section>
      {!demoModeEnabled() && <form action={signOut}><button className="h-12 w-full rounded-xl border border-[#D8DEE8] bg-white font-semibold">{t.settings.signOut}</button></form>}
    </Page>
  );
}
