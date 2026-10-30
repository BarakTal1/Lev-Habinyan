import type { ReactNode } from "react";

/** The title block at the top of a screen: title, an optional line below it, and actions on the far side. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3 px-5 pb-4 pt-5 lg:px-8 lg:pt-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-bold leading-[1.15] lg:text-[30px]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
      </div>
      {actions}
    </header>
  );
}
