import { splitAddress } from "@/lib/address";

const SIZE = { sm: "h-10 w-10 rounded-[10px] text-[17px]", md: "h-12 w-12 rounded-xl text-xl", lg: "h-14 w-14 rounded-[14px] text-2xl" } as const;

/** A house-number plaque, like the enamel signs on Israeli buildings. It names the building at a glance. */
export function Plaque({ name, size = "sm" }: { name: string; size?: keyof typeof SIZE }) {
  const { street, number } = splitAddress(name);
  const text = number ?? street.slice(0, 1);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center bg-navy font-extrabold leading-none tracking-tight text-white shadow-[inset_0_0_0_2px_#1B2A4A,inset_0_0_0_3.5px_rgba(255,255,255,0.8)] ${SIZE[size]}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {text}
    </span>
  );
}
