import { badge, type BadgeList } from "@/lib/tokens";
import { Icon } from "./Icon";

export function Badge({ list, value, pill, label }: { list: BadgeList; value: string; pill?: boolean; label?: string }) {
  const b = badge(list, value);
  const round = pill ?? list === "urgency";
  return (
    <span
      className="inline-flex h-[26px] flex-none items-center gap-0.5 whitespace-nowrap px-2.5 text-[13px] font-semibold"
      style={{ backgroundColor: b.bg, color: b.fg, borderRadius: round ? 999 : 8 }}
    >
      {list === "urgency" && <Icon name={b.icon} size={16} />}
      {label ?? b.label}
    </span>
  );
}
