import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DeskRail } from "@/components/DeskRail";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-dvh">
      <DeskRail />
      <div className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</div>
      <BottomNav />
    </div>
  );
}
