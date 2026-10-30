import Link from "next/link";
import { Icon } from "@/components/Icon";
import { NAV_EXTRA } from "@/components/nav-items";

export default function MorePage() {
  return (
    <main className="p-4">
      <h1 className="px-1 pb-3 pt-2 text-[26px] font-bold">עוד</h1>
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-[#E8ECF2]">
        {NAV_EXTRA.map((n) => (
          <Link key={n.href} href={n.href} className="flex h-[68px] items-center gap-3 bg-white px-4 text-base font-semibold">
            <Icon name={n.icon} size={24} />
            <span className="flex-1">{n.label}</span>
            <Icon name="chevron_left" size={22} />
          </Link>
        ))}
      </div>
    </main>
  );
}
