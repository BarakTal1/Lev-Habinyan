import { t } from "@/lib/labels";
import { signOut } from "../sign-in/actions";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">{t.signIn.noAccess}</h1>
      <p className="text-muted">{t.signIn.noAccessHelp}</p>
      <form action={signOut}>
        <button className="h-12 rounded-xl border border-navy px-6 font-semibold text-navy">יציאה</button>
      </form>
    </main>
  );
}
