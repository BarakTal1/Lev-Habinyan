import { fitFontSize, plaqueSpec } from "@/lib/plaque";

// Widths are in px. The inner width leaves room for the padding and the double border.
const SIZE = {
  sm: { box: "h-11 w-[76px] rounded-[10px]", inner: 62, street: 11, num: "text-[18px]" },
  md: { box: "h-12 w-[88px] rounded-xl", inner: 72, street: 12, num: "text-[20px]" },
  lg: { box: "h-14 w-[104px] rounded-[14px]", inner: 86, street: 13, num: "text-[24px]" },
} as const;

/** A building plaque, like the enamel signs on Israeli buildings. It shows the full street name and the number. The street name shrinks to fit. */
export function Plaque({ name, size = "sm" }: { name: string; size?: keyof typeof SIZE }) {
  const { street, number, color } = plaqueSpec(name);
  const s = SIZE[size];
  return (
    <span
      aria-hidden="true"
      dir="rtl"
      className={`inline-flex flex-none flex-col items-center justify-center gap-px px-1.5 font-extrabold leading-none text-white shadow-[inset_0_0_0_2px_var(--plaque),inset_0_0_0_3.5px_rgba(255,255,255,0.8)] ${s.box}`}
      style={{ backgroundColor: color, ["--plaque" as string]: color, fontVariantNumeric: "tabular-nums" }}
    >
      <span className="whitespace-nowrap font-semibold opacity-95" style={{ fontSize: fitFontSize(street, s.inner, number ? s.street : s.street + 3) }}>{street}</span>
      {number && <span className={`${s.num} tracking-tight`}>{number}</span>}
    </span>
  );
}
