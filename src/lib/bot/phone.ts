/** One form for every phone the bot compares: digits only, Israeli numbers as 972…, or null when there are no digits. */
export function normalizePhone(p: string | null | undefined): string | null {
  const d = (p ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("972") ? d : d.startsWith("0") ? "972" + d.slice(1) : d;
}
