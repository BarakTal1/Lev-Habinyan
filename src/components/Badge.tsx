import { badge, type BadgeList } from "@/lib/tokens";
import { Icon } from "./Icon";

export function Badge({ list, value, pill }: { list: BadgeList; value: string; pill?: boolean }) {
  const b = badge(list, value);
  const round = pill ?? list === "urgency";
  return (
    <span
      className="inline-flex h-[26px] flex-none items-center gap-0.5 whitespace-nowrap px-2.5 text-[13px] font-semibold"
      style={{ backgroundColor: b.bg, color: b.fg, borderRadius: round ? 999 : 8 }}
    >
      <Icon name={b.icon} size={16} />
      {b.label}
    </span>
  );
}
