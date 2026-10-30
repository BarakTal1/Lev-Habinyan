import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DeskRail } from "@/components/DeskRail";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { requireUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <DeskRail userName={user.name} signOut={demoModeEnabled() ? undefined : signOut} />
      <div className="min-w-0 flex-1 pb-24 lg:pb-10">{children}</div>
      <BottomNav />
    </div>
  );
}
