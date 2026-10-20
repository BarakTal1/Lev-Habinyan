import type { ReactNode } from "react";

/** A labelled field. Use `group` for chip groups, so a tap on the label never triggers the first chip. */
export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  const text = <span className="text-sm font-semibold text-muted">{label}</span>;
  if (group) {
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-1.5">
        {text}
        {children}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      {text}
      {children}
    </label>
  );
}

export const inputCls = "h-12 w-full rounded-xl border border-[#DAD5CB] bg-white px-3 text-base outline-none focus:ring-2 focus:ring-navy/30";
