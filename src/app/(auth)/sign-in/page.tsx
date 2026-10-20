import Image from "next/image";
import { t } from "@/lib/labels";
import { GoogleButton } from "./GoogleButton";
import { devSignIn } from "./actions";

export default function SignInPage() {
  const dev = process.env.NEXT_PUBLIC_DEV_LOGIN === "1";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4">
      <Image src="/logo.png" alt={t.appName} width={140} height={140} priority />
      <h1 className="text-2xl font-extrabold">{t.signIn.title}</h1>
      <GoogleButton />
      {dev && (
        <form action={devSignIn} className="flex w-full flex-col gap-2 rounded-2xl border border-dashed border-muted/40 p-3">
          <span className="text-sm text-muted">DEV</span>
          <input name="email" type="email" dir="ltr" placeholder="email" className="h-12 rounded-xl border px-3" />
          <input name="password" type="password" dir="ltr" placeholder="password" className="h-12 rounded-xl border px-3" />
          <button className="h-12 rounded-xl bg-navy font-semibold text-white">DEV</button>
        </form>
      )}
    </main>
  );
}
