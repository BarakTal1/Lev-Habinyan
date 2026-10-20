import type { ReactNode } from "react";

/** Wraps phone numbers and times so they read left to right inside Hebrew text. */
export function LtrText({ children }: { children: ReactNode }) {
  return <span dir="ltr">{children}</span>;
}
