"use client";
import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";
import { t } from "@/lib/labels";

/** Bottom sheet on phones, centered panel on desktop. The primary action goes in `footer`, pinned to the bottom. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(14,20,36,.45)] lg:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white lg:rounded-3xl"
      >
        <div className="flex justify-center pb-1 pt-2 lg:hidden"><div className="h-[5px] w-10 rounded-full bg-[#D6D1C7]" /></div>
        <div className="flex items-center px-4 pb-2 pt-1">
          <h2 className="flex-1 text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="flex h-12 w-12 items-center justify-center text-muted">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-3">{children}</div>
        {footer && <div className="border-t border-[#EFEBE3] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
