"use client";
import { Icon } from "./Icon";

export function CheckButton({ onCheck, label, busy }: { onCheck: () => void; label: string; busy?: boolean }) {
  return (
    <button type="button" onClick={onCheck} disabled={busy} aria-label={label} className="flex h-12 w-12 flex-none items-center justify-center">
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-[#C3CAD8] text-[#8A909C]">
        <Icon name="check" size={18} />
      </span>
    </button>
  );
}
