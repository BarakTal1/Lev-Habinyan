"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { t } from "@/lib/labels";

const EXIT_MS = 260;

/** Bottom sheet on phones, centered panel on desktop. The primary action goes in `footer`, pinned to the bottom. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  // Keep the sheet mounted while it plays its exit, so it leaves the way it came.
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }
  const closing = !open && mounted;

  useEffect(() => {
    if (open || !mounted) return;
    const id = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(id);
  }, [open, mounted]);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!mounted) return null;
  const state = closing ? { "data-closing": "" } : {};
  return (
    <div
      {...state}
      className="sheet-scrim fixed inset-0 z-40 flex items-end justify-center bg-[rgba(14,20,36,.4)] backdrop-blur-[2px] lg:items-center"
      onClick={close}
    >
      <div
        {...state}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="sheet-panel flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(14,20,36,.18)] lg:rounded-[28px] lg:shadow-[0_24px_64px_rgba(14,20,36,.28)]"
      >
        <div className="flex justify-center pb-1 pt-2.5 lg:hidden"><div className="h-[5px] w-9 rounded-full bg-[#D6D1C7]" /></div>
        <div className="flex items-center px-5 pb-2 pt-1">
          <h2 className="flex-1 text-[19px] font-bold tracking-[-0.015em]">{title}</h2>
          <button type="button" onClick={close} aria-label={t.common.close} className="press flex h-10 w-10 items-center justify-center rounded-full bg-[#F1EFEA] text-muted">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-[var(--hairline)] p-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
