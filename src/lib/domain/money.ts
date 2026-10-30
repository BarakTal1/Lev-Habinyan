// Money is whole agorot (integers) everywhere in the app. Floats never hold an amount.

const SHEKEL_WORDS = /₪|ש"ח|ש״ח|שח|nis|ils/gi;

/** Reads an amount in shekels as typed by a person or exported by a spreadsheet. Returns agorot, or null when the text is not one amount. */
export function parseAmount(text: string): number | null {
  const s = text.replace(SHEKEL_WORDS, "").replace(/[\s,]/g, "");
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const agorot = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -agorot : agorot;
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₪1,200 for whole shekels, ₪1,200.50 otherwise, -₪50 for a negative amount. */
export function formatILS(agorot: number): string {
  const abs = Math.abs(agorot);
  const text = abs % 100 === 0 ? whole.format(abs / 100) : cents.format(abs / 100);
  return `${agorot < 0 ? "-" : ""}₪${text}`;
}
