"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV_GROUPS, isActive } from "./nav-items";

/** Desktop side menu: logo, grouped links, and the signed-in user at the bottom. Hidden below 1024 px. */
export function DeskRail({ userName, signOut }: { userName: string; signOut?: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] flex-none flex-col border-s border-line bg-white lg:flex">
      <div className="flex h-[104px] items-center px-6">
        <Image src="/logo.png" alt="לב הבניין" width={80} height={83} priority />
      </div>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1.5 text-[12px] font-semibold tracking-[0.04em] text-muted/80">{g.title}</div>
            {g.items.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`press relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] ${active ? "bg-brand-soft font-semibold text-brand" : "text-ink hover:bg-[#F4F6FA]"}`}
                >
                  {active && <span aria-hidden="true" className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand" />}
                  <Icon name={n.icon} size={21} filled={active} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-xl border border-line p-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{userName.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{userName}</div>
          <div className="text-[12px] text-muted">מנהל</div>
        </div>
        {signOut && (
          <form action={signOut}>
            <button aria-label="התנתקות" className="press flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-[#F4F6FA]">
              <Icon name="logout" size={20} />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
