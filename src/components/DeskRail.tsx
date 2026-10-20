"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV, NAV_EXTRA, isActive } from "./nav-items";

export function DeskRail() {
  const pathname = usePathname();
  const items = [...NAV.filter((n) => n.href !== "/more"), ...NAV_EXTRA];
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 flex-none flex-col gap-1 border-s border-[#EFEBE3] bg-white p-4 lg:flex">
      <Image src="/logo.png" alt="לב הבניין" width={72} height={72} className="mb-4 self-start" />
      {items.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`flex h-12 items-center gap-3 rounded-xl px-3 text-base ${active ? "bg-[#E3E8F2] font-bold text-navy" : "text-ink"}`}>
            <Icon name={n.icon} size={22} filled={active} />
            {n.label}
          </Link>
        );
      })}
    </aside>
  );
}
