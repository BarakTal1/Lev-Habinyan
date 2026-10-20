import { getSetting } from "@/lib/db/people";
import { t } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { setEmailRemindersAction } from "../people-actions";

export default async function SettingsPage() {
  const db = await createClient();
  const [on, profiles] = await Promise.all([
    getSetting(db, "email_reminders", false),
    db.from("profile").select("id, email, person:person_id(name)").order("email"),
  ]);
  const card = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(27,42,74,.06),0_4px_14px_rgba(27,42,74,.05)]";
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="px-1 pt-2 text-[26px] font-bold">{t.settings.title}</h1>
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
      <form action={signOut}><button className="h-12 w-full rounded-xl border border-[#DAD5CB] bg-white font-semibold">{t.settings.signOut}</button></form>
    </main>
  );
}
