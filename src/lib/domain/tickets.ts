export const CLOSED_STATUSES = ["בוצע", "בוטל"] as const;

export function isOpen(status: string): boolean {
  return !(CLOSED_STATUSES as readonly string[]).includes(status);
}

/** Hours an open fault has waited with no first action, or null when it is not flagged (24 hours or less, handled, closed, or not a fault). */
export function hoursWithoutAction(
  t: { kind: "fault" | "task"; status: string; created_at: string; first_action_at: string | null },
  now: Date,
): number | null {
  if (t.kind !== "fault" || !isOpen(t.status) || t.first_action_at) return null;
  const hours = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / 3_600_000);
  return hours > 24 ? hours : null;
}
