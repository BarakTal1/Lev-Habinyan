/** Dark tones that keep white text above 4.5:1. */
const COLORS = ["#1B2A4A", "#0B5D5A", "#5B2A6B", "#7A1F3D", "#1F5A33", "#6B3F1D", "#2B4C8C", "#4D5A14"] as const;

/** Splits a building name such as "דיזנגוף 78" into the street and the house number. */
export function splitAddress(name: string): { street: string; number: string | null } {
  const m = name.trim().match(/^(.*\S)\s+(\d+[א-ת]?)$/);
  return m ? { street: m[1], number: m[2] } : { street: name.trim(), number: null };
}

/** The largest font size, in px, that fits the whole street name on one line. Hebrew letters average about half an em wide. */
export function fitFontSize(text: string, innerWidth: number, maxSize: number, minSize = 7.5): number {
  const len = [...text].length;
  if (len === 0) return maxSize;
  return Math.round(Math.max(minSize, Math.min(maxSize, innerWidth / (len * 0.52))) * 10) / 10;
}

function hash(s: string): number {
  let h = 5381;
  for (const ch of s) h = ((h << 5) + h + ch.codePointAt(0)!) | 0;
  return Math.abs(h);
}

export type PlaqueSpec = { street: string; number: string; color: string };

/** What a building's plaque shows. The same name always gives the same plaque. The full street, the number and the color together tell buildings apart. */
export function plaqueSpec(name: string): PlaqueSpec {
  const { street, number } = splitAddress(name);
  return { street, number: number ?? "", color: COLORS[hash(name.trim()) % COLORS.length] };
}
