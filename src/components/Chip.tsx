import type { ReactNode } from "react";

export function Chip({ selected, onClick, children, type = "button" }: { selected?: boolean; onClick?: () => void; children: ReactNode; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={selected}
      className={`h-10 whitespace-nowrap rounded-full px-3.5 text-[15px] ${selected ? "bg-navy font-semibold text-white" : "border border-[#DAD5CB] bg-white"}`}
    >
      {children}
    </button>
  );
}
