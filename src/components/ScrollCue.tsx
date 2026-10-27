"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A scroll box that shows a fade and a hint while more content waits at the end edge. */
export function ScrollCue({ children, hint, className }: { children: ReactNode; hint: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore(el.scrollWidth > el.clientWidth + 2 && Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 2);
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div>
      <div className="relative">
        <div ref={ref} className={className}>{children}</div>
        {more && <div aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-10 rounded-s-2xl bg-gradient-to-l from-white to-transparent" />}
      </div>
      {more && <p className="px-1 pt-2 text-center text-sm text-muted">{hint}</p>}
    </div>
  );
}
