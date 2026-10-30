"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV, isActive } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="material fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_var(--material-edge)] lg:hidden">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`press flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] tracking-[0.01em] ${active ? "font-bold text-navy" : "font-medium text-muted"}`}>
            <Icon name={n.icon} size={24} filled={active} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
