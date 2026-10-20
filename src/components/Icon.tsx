import { ICONS } from "./icons.generated";

export function Icon({ name, size = 22, filled = false, className }: { name: string; size?: number; filled?: boolean; className?: string }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={{ flex: "none" }}
    >
      <path d={filled ? icon.f : icon.o} />
    </svg>
  );
}
