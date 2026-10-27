/** Splits a building name such as "דיזנגוף 78" into the street and the house number. */
export function splitAddress(name: string): { street: string; number: string | null } {
  const m = name.trim().match(/^(.*\S)\s+(\d+[א-ת]?)$/);
  return m ? { street: m[1], number: m[2] } : { street: name.trim(), number: null };
}
