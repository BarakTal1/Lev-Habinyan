const digits = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "");

/** wa.me link for an Israeli number. Accepts 052-..., +972-52-... and 97252.... */
export function waLink(phone: string | null | undefined): string | null {
  let d = digits(phone);
  if (!d) return null;
  if (!d.startsWith("972") && d.startsWith("0")) d = "972" + d.slice(1);
  return `https://wa.me/${d}`;
}

export function telLink(phone: string | null | undefined): string | null {
  const p = (phone ?? "").replace(/[^\d+]/g, "");
  return p ? `tel:${p}` : null;
}
