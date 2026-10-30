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

/** True for an Israeli phone number: 9 or 10 digits that start with 0, or the same number written with 972. */
export function isPhone(phone: string | null | undefined): boolean {
  let d = digits(phone);
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^0\d{8,9}$/.test(d);
}
