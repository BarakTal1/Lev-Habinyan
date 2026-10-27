import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { Plaque } from "./Plaque";
import { DEFAULT_URGENCY, urgencyEdge, type BadgeList } from "@/lib/tokens";

const KIND_ICON = { fault: "report", task: "task_alt", maintenance: "build" } as const;

export type RowProps = {
  kind: keyof typeof KIND_ICON;
  title: string;
  building: string | null;
  meta?: string;
  late?: boolean;
  badge?: { list: BadgeList; value: string };
  flag?: string;
  trailing?: ReactNode;
  href?: string;
  /** Extra columns shown from 1024 px up (assignee, due date). */
  extra?: { assignee: string | null; due: string | null };
};

export function Row({ kind, title, building, meta, late, badge, flag, trailing, href, extra }: RowProps) {
  const edge = badge?.list === "urgency" ? urgencyEdge(badge.value) : null;
  const showBadge = badge && !(badge.list === "urgency" && badge.value === DEFAULT_URGENCY);
  const body = (
    <>
      {building ? (
        <Plaque name={building} />
      ) : (
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-[var(--hairline)] text-muted">
          <Icon name={KIND_ICON[kind]} size={20} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div dir="rtl" className="text-base font-semibold leading-snug tracking-[-0.005em]">{title}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {building && <span className="font-medium text-ink/80">{building}</span>}
          {meta && <span className={`whitespace-nowrap ${late ? "font-medium text-[#B3261E]" : "font-medium"}`}>{building && <span className="font-normal text-muted">· </span>}{meta}</span>}
        </div>
        {flag && <div className="text-[13px] font-semibold text-[#B3261E]">{flag}</div>}
      </div>
      {extra && (
        <>
          <div className="hidden w-40 flex-none text-sm lg:block">{extra.assignee ?? <span className="text-muted">לא שויך</span>}</div>
          <div className="hidden w-24 flex-none text-sm lg:block" dir="ltr">{extra.due ?? ""}</div>
        </>
      )}
      {showBadge && <Badge list={badge.list} value={badge.value} />}
    </>
  );
  const cls = "press-row flex min-h-[72px] items-center gap-3 bg-white py-2.5 pe-3.5 ps-3";
  return (
    <div className="relative flex items-center bg-white">
      {edge && <span aria-hidden="true" data-testid="row-edge" className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: edge }} />}
      {href ? <Link href={href} className={`${cls} flex-1`}>{body}</Link> : <div className={`${cls} flex-1`}>{body}</div>}
      {trailing && <div className="flex-none">{trailing}</div>}
    </div>
  );
}
