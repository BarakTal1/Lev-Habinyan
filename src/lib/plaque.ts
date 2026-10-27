/** Dark tones that keep white text above 4.5:1. */
const COLORS = ["#1B2A4A", "#0B5D5A", "#5B2A6B", "#7A1F3D", "#1F5A33", "#6B3F1D", "#2B4C8C", "#4D5A14"] as const;

/** Splits a building name such as "דיזנגוף 78" into the street and the house number. */
export function splitAddress(name: string): { street: string; number: string | null } {
  const m = name.trim().match(/^(.*\S)\s+(\d+[א-ת]?)$/);
  return m ? { street: m[1], number: m[2] } : { street: name.trim(), number: null };
}

/** A short code for the street: initials of a name with several words, the first three letters of a single word. */
export function streetCode(street: string): string {
  const words = street.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join("");
  return [...street].slice(0, 3).join("");
}

function hash(s: string): number {
  let h = 5381;
  for (const ch of s) h = ((h << 5) + h + ch.codePointAt(0)!) | 0;
  return Math.abs(h);
}

export type PlaqueSpec = { code: string; number: string; color: string };

/** What a building's plaque shows. The same name always gives the same plaque. The street code, the number and the color together tell buildings apart. */
export function plaqueSpec(name: string): PlaqueSpec {
  const { street, number } = splitAddress(name);
  return { code: streetCode(street), number: number ?? "", color: COLORS[hash(name.trim()) % COLORS.length] };
}
