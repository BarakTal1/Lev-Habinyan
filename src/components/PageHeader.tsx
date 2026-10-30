import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

type Back = { href: string; label: string };

/** The title block at the top of a screen: title, an optional line below it, and actions on the far side. */
export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: Back }) {
  return (
    <header className={`flex flex-wrap items-end gap-3 px-5 pb-4 lg:px-8 ${back ? "pt-2" : "pt-5 lg:pt-8"}`}>
      {back && (
        <Link href={back.href} className="press -ms-1 -mb-1 inline-flex h-10 w-full items-center gap-1 text-[15px] font-semibold text-brand lg:mt-4">
          <Icon name="arrow_forward" size={20} />{back.label}
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-bold leading-[1.15] lg:text-[30px]">{title}</h1>
        {sub && <div className="mt-1 text-[15px] text-muted">{sub}</div>}
      </div>
      {actions}
    </header>
  );
}

const WIDTH = { full: "", wide: "max-w-5xl", medium: "max-w-3xl", narrow: "max-w-2xl" } as const;

/** A whole screen: the header, the page padding, and a content width. Narrow content sits at the start side, next to the menu. */
export function Page({ title, sub, actions, back, width = "full", className = "", children }: {
  title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: Back; width?: keyof typeof WIDTH; className?: string; children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1280px]">
      <PageHeader title={title} sub={sub} actions={actions} back={back} />
      <div className="px-4 pb-6 lg:px-8">
        <div className={`${WIDTH[width]} ${className}`}>{children}</div>
      </div>
    </main>
  );
}
