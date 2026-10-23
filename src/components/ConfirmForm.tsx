"use client";
import type { ReactNode } from "react";

/** A form that asks for a yes before it submits. For actions that are hard to undo. */
export function ConfirmForm({ action, message, children }: { action: () => void | Promise<void>; message: string; children: ReactNode }) {
  return <form action={action} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</form>;
}
