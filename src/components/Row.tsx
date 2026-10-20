import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import type { BadgeList } from "@/lib/tokens";

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
  const body = (
    <>
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#F1EFEA] text-navy">
        <Icon name={KIND_ICON[kind]} size={22} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div dir="rtl" className="text-base font-semibold leading-snug">{title}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {building && <span>{building}</span>}
          {building && meta && <span>·</span>}
          {meta && <span className={late ? "font-medium text-[#B3261E]" : "font-medium"}>{meta}</span>}
        </div>
        {flag && (
          <div className="inline-flex items-center gap-1 self-start rounded-md bg-[#FBE3BC] px-2 text-[13px] font-semibold text-[#7A4A00]">
            <Icon name="hourglass_bottom" size={16} />
            {flag}
          </div>
        )}
      </div>
      {extra && (
        <>
          <div className="hidden w-40 flex-none text-sm lg:block">{extra.assignee ?? <span className="text-muted">לא שויך</span>}</div>
          <div className="hidden w-24 flex-none text-sm lg:block" dir="ltr">{extra.due ?? ""}</div>
        </>
      )}
      {badge && <Badge list={badge.list} value={badge.value} />}
    </>
  );
  const cls = "flex min-h-[72px] items-center gap-3 bg-white py-2.5 pe-3.5 ps-1.5";
  return (
    <div className="flex items-center bg-white">
      {href ? <Link href={href} className={`${cls} flex-1`}>{body}</Link> : <div className={`${cls} flex-1`}>{body}</div>}
      {trailing && <div className="flex-none">{trailing}</div>}
    </div>
  );
}
