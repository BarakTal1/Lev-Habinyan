import { addFrequency, type FreqUnit } from "@/lib/domain/maintenance";
import { SYSTEMS, type System } from "@/lib/labels";
import { isoDate, splitCsv } from "./sheet";

/**
 * Parser for the founders' control sheet ("בקרה תחזוקת בניינים").
 * PROVISIONAL FORMAT: one row per building, the first column is the building, and one column per system.
 * Each cell holds a frequency (for example שבועי), a last inspection date, both, "-" (not applicable) or nothing.
 * The real file layout has not been seen yet. Adjust this file when a sample arrives.
 */

export type ParsedRow = {
  row: number; building: string; system: System; applicable: boolean;
  frequency_unit?: FreqUnit; frequency_count?: number; last_done_at?: string;
};
export type Problem = { row: number; column: string; reason: string };

const ALIASES: Record<string, System> = {
  "ניקיון": "ניקיון", "גינון": "גינון", "מעלית": "בדיקת מעלית", "בדיקת מעלית": "בדיקת מעלית",
  "כיבוי אש": "בדיקת כיבוי אש", "בדיקת כיבוי אש": "בדיקת כיבוי אש", "אש": "בדיקת כיבוי אש", "הדברה": "הדברה",
  "חשמל": "שעוני חשמל", "שעוני חשמל": "שעוני חשמל", "אינסטלציה": "בדיקת אינסטלציה", "בדיקת אינסטלציה": "בדיקת אינסטלציה",
  "ביוב": "ניקוי פיר ביוב", "פיר ביוב": "ניקוי פיר ביוב", "ניקוי פיר ביוב": "ניקוי פיר ביוב", "גג": "בדיקת גג", "בדיקת גג": "בדיקת גג",
  "משאבות": "משאבות", "מים": "חיטוי מאגר מים", "מאגר מים": "חיטוי מאגר מים", "חיטוי מאגר מים": "חיטוי מאגר מים",
  "שער": "שער חניון", "חניון": "שער חניון", "שער חניון": "שער חניון",
};
const NOT_APPLICABLE = new Set(["-", "—", "–", "לא רלוונטי", "לא רלבנטי", "אין", "n/a", "N/A"]);

const FREQ: Record<string, [FreqUnit, number]> = {
  "יומי": ["day", 1], "שבועי": ["week", 1], "דו שבועי": ["week", 2], "כל שבועיים": ["week", 2],
  "חודשי": ["month", 1], "דו חודשי": ["month", 2], "כל חודשיים": ["month", 2], "רבעוני": ["month", 3],
  "חצי שנתי": ["month", 6], "כל חצי שנה": ["month", 6], "שנתי": ["year", 1], "דו שנתי": ["year", 2], "כל שנתיים": ["year", 2],
  "כל יום": ["day", 1], "כל שבוע": ["week", 1], "כל חודש": ["month", 1], "כל שנה": ["year", 1],
};
const UNIT_WORDS: Record<string, FreqUnit> = { "ימים": "day", "שבועות": "week", "חודשים": "month", "שנים": "year" };

type Cell = { applicable: boolean; frequency_unit?: FreqUnit; frequency_count?: number; last_done_at?: string } | { problem: string };

function parseCell(raw: string): Cell {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { applicable: true };
  if (NOT_APPLICABLE.has(text)) return { applicable: false };
  let rest = text, last: string | undefined;
  const dmy = rest.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  const ymd = rest.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) { last = isoDate(+ymd[3], +ymd[2], +ymd[1]) ?? undefined; if (!last) return { problem: "תאריך לא תקין" }; rest = rest.replace(ymd[0], " "); }
  else if (dmy) { last = isoDate(+dmy[1], +dmy[2], +dmy[3]) ?? undefined; if (!last) return { problem: "תאריך לא תקין" }; rest = rest.replace(dmy[0], " "); }
  rest = rest.replace(/[־–]/g, " ").replace(/(?<=\S)-(?=\S)/g, " ").replace(/\s+/g, " ").trim();
  if (!rest) return { applicable: true, ...(last ? { last_done_at: last } : {}) };
  const direct = FREQ[rest];
  if (direct) return { applicable: true, frequency_unit: direct[0], frequency_count: direct[1], ...(last ? { last_done_at: last } : {}) };
  const m = rest.match(/^כל (\d+) (ימים|שבועות|חודשים|שנים)$/);
  if (m && +m[1] > 0) return { applicable: true, frequency_unit: UNIT_WORDS[m[2]], frequency_count: +m[1], ...(last ? { last_done_at: last } : {}) };
  return { problem: "לא הצלחנו להבין את התא" };
}

export function parseControlSheet(input: string): { rows: ParsedRow[]; problems: Problem[] } {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const table = splitCsv(text, delimiter);
  const header = (table[0] ?? []).map((h) => h.trim());
  const problems: Problem[] = [];
  const colSystem: (System | null)[] = header.map((h, i) => {
    if (i === 0) return null;
    const s = ALIASES[h];
    if (!s && h) problems.push({ row: 1, column: h, reason: "עמודה לא מוכרת" });
    return s ?? null;
  });

  const rows: ParsedRow[] = [];
  for (let li = 1; li < table.length; li++) {
    const cells = table[li];
    const building = (cells[0] ?? "").trim();
    if (!building) continue;
    const bySystem = new Map<System, Cell>();
    colSystem.forEach((sys, ci) => {
      if (!sys) return;
      const parsed = parseCell(cells[ci] ?? "");
      if ("problem" in parsed) problems.push({ row: li + 1, column: header[ci], reason: parsed.problem });
      bySystem.set(sys, parsed);
    });
    for (const system of SYSTEMS) {
      const c = bySystem.get(system);
      const ok = c && !("problem" in c) ? c : { applicable: true };
      rows.push({ row: li + 1, building, system, ...ok });
    }
  }
  return { rows, problems };
}

export function summarizeImport(rows: ParsedRow[], existingBuildings: string[]): { buildings: { name: string; isNew: boolean }[]; items: number } {
  const existing = new Set(existingBuildings.map((b) => b.trim()));
  const seen: string[] = [];
  for (const r of rows) if (!seen.includes(r.building)) seen.push(r.building);
  return { buildings: seen.map((name) => ({ name, isNew: !existing.has(name) })), items: rows.length };
}

/** The next due date for a parsed row, when it has both a frequency and a last done date. */
export function nextDueFor(r: Pick<ParsedRow, "frequency_unit" | "frequency_count" | "last_done_at">): string | null {
  return r.frequency_unit && r.frequency_count && r.last_done_at ? addFrequency(r.last_done_at, r.frequency_unit, r.frequency_count) : null;
}
