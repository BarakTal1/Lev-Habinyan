import { plaqueSpec } from "@/lib/plaque";

const SIZE = {
  sm: { box: "h-11 w-11 rounded-[10px]", code: "text-[10px]", num: "text-[17px]" },
  md: { box: "h-12 w-12 rounded-xl", code: "text-[11px]", num: "text-[19px]" },
  lg: { box: "h-14 w-14 rounded-[14px]", code: "text-xs", num: "text-[22px]" },
} as const;

/** A building plaque, like the enamel signs on Israeli buildings. The street code, the number and the color are set by the address, so two buildings with the same number still differ. */
export function Plaque({ name, size = "sm" }: { name: string; size?: keyof typeof SIZE }) {
  const { code, number, color } = plaqueSpec(name);
  const s = SIZE[size];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none flex-col items-center justify-center gap-px font-extrabold leading-none text-white shadow-[inset_0_0_0_2px_var(--plaque),inset_0_0_0_3.5px_rgba(255,255,255,0.8)] ${s.box}`}
      style={{ backgroundColor: color, ["--plaque" as string]: color, fontVariantNumeric: "tabular-nums" }}
    >
      <span className={`${s.code} font-semibold tracking-wide opacity-90`}>{code}</span>
      {number && <span className={`${s.num} tracking-tight`}>{number}</span>}
    </span>
  );
}
