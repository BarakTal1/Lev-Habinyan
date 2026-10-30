// Shared helpers for spreadsheet imports: decode, split, and read dates, months and apartment numbers.
// Israeli files put the day first. A date is never read month first.

export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  row.push(cur); rows.push(row);
  return rows;
}

export function isoDate(d: number, m: number, y: number): string | null {
  const year = y < 100 ? 2000 + y : y;
  const dt = new Date(Date.UTC(year, m - 1, d));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** UTF-8 when the bytes are valid UTF-8 (the byte order mark is dropped), else Windows-1255, which Excel uses for Hebrew CSV. */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1255").decode(bytes);
  }
}

/** A grid of trimmed cells. The delimiter is the one that splits the first line most. Rows with no text are dropped. */
export function csvToGrid(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  return splitCsv(clean, delimiter)
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

// Excel counts days from 1899-12-30. Serials in this range cover the years 1954 to 2119.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const SERIAL_MIN = 20000;
const SERIAL_MAX = 80000;

/** A date as YYYY-MM-DD, or null. Accepts DD/MM/YYYY, D/M/YY, DD.MM.YYYY, YYYY-MM-DD and Excel serial numbers. */
export function parseDate(cell: string): string | null {
  const s = cell.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return isoDate(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  if (/^\d+$/.test(s) && +s >= SERIAL_MIN && +s <= SERIAL_MAX) return new Date(EXCEL_EPOCH + +s * 86_400_000).toISOString().slice(0, 10);
  return null;
}

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const firstOf = (month: number, year: number): string | null => isoDate(1, month, year);

/** The first day of a month, or null. Accepts MM/YYYY, MM.YYYY, YYYY-MM, a Hebrew month name with a year, and any date parseDate reads. */
export function parseMonth(cell: string): string | null {
  const s = cell.trim();
  let m = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (m) return firstOf(+m[1], +m[2]);
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return firstOf(+m[2], +m[1]);
  m = s.match(/^(\S+)\s+(\d{4})$/);
  if (m) {
    const i = HEBREW_MONTHS.indexOf(m[1]);
    return i >= 0 ? firstOf(i + 1, +m[2]) : null;
  }
  const d = parseDate(s);
  return d ? d.slice(0, 8) + "01" : null;
}

/** One form for an apartment number: no spaces, no leading zeros, a Hebrew letter suffix kept (" 03 " → "3", "3 א" → "3א"). */
export function normUnit(cell: string): string {
  return cell.replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
}
