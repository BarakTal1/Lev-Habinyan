import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/PageHeader";
import { NAV, NAV_GROUPS } from "@/components/nav-items";

// The phone bar already shows these screens, so the More page lists only the rest, in the same groups as the desktop menu.
const IN_BAR = new Set<string>(NAV.map((n) => n.href));
const GROUPS = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => !IN_BAR.has(n.href)) })).filter((g) => g.items.length > 0);

export default function MorePage() {
  return (
    <Page title="עוד" width="narrow" className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[0.04em] text-muted">{g.title}</h2>
          <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--card-shadow)]">
            {g.items.map((n) => (
              <Link key={n.href} href={n.href} className="press-row flex h-[60px] items-center gap-3 bg-white px-4 text-base font-semibold">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-brand-soft text-brand"><Icon name={n.icon} size={20} /></span>
                <span className="flex-1">{n.label}</span>
                <Icon name="chevron_left" size={22} className="text-muted" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
