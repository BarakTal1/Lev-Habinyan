import Link from "next/link";
import { Icon } from "./Icon";

export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="press fixed bottom-24 left-4 z-20 flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-navy text-white shadow-[0_1px_2px_rgba(27,42,74,.2),0_10px_24px_rgba(27,42,74,.32)] active:shadow-[0_1px_2px_rgba(27,42,74,.2),0_4px_10px_rgba(27,42,74,.28)] lg:bottom-8"
    >
      <Icon name="add" size={32} />
    </Link>
  );
}
