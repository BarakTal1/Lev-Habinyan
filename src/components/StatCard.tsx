import Link from "next/link";
import { Icon } from "./Icon";

const TONE = {
  brand: { tile: "bg-brand-soft text-brand" },
  danger: { tile: "bg-[#FCE4E1] text-[#B3261E]" },
  warn: { tile: "bg-[#FDF0DC] text-[#8A5300]" },
  ok: { tile: "bg-[#E3F4EA] text-[#1F7A47]" },
} as const;

/** One number with its label and an icon tile. The whole card links to the list behind the number. */
export function StatCard({ label, value, icon, tone = "brand", hint, href }: {
  label: string; value: number | string; icon: string; tone?: keyof typeof TONE; hint?: string; href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-medium text-muted">{label}</span>
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] ${TONE[tone].tile}`}>
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="mt-1 text-[30px] font-extrabold leading-none tracking-[-0.02em] text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </>
  );
  const cls = "card flex flex-col p-4";
  return href ? <Link href={href} className={`${cls} press-row hover:border-[#CED6E2]`}>{body}</Link> : <div className={cls}>{body}</div>;
}
