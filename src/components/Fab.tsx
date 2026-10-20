import Link from "next/link";
import { Icon } from "./Icon";

export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed bottom-24 left-4 z-20 flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-navy text-white shadow-[0_8px_20px_rgba(27,42,74,.35)] lg:bottom-8"
    >
      <Icon name="add" size={32} />
    </Link>
  );
}
