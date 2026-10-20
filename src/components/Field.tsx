import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "h-12 w-full rounded-xl bg-[#F7F5F0] px-3 text-base outline-none focus:ring-2 focus:ring-navy/30";
