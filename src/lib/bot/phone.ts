/**
 * One form for every phone the bot compares: digits 0-9 only, Israeli numbers as 972…, or null when there are no digits.
 * The SQL function phone_normalize (migration 0013) gives the same result for every input.
 */
export function normalizePhone(p: string | null | undefined): string | null {
  const d = (p ?? "").replace(/[^0-9]/g, "").replace(/^00/, "");
  if (!d) return null;
  if (d.startsWith("972")) return "972" + d.slice(3).replace(/^0/, "");
  return d.startsWith("0") ? "972" + d.slice(1) : d;
}

/** The local form of an Israeli number (0521234567), for storing a person's phone the way founders type it. */
export function toLocalPhone(p: string): string {
  const n = normalizePhone(p) ?? "";
  return n.startsWith("972") ? "0" + n.slice(3) : n;
}
