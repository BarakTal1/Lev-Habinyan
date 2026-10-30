import { parseAmount } from "@/lib/domain/money";
import type { Method } from "@/lib/domain/ledger";
import type { Problem } from "./controlSheet";
import { normUnit, parseDate, parseMonth } from "./sheet";

/**
 * Parsers for the monthly tariff sheet and the payments sheet.
 * PROVISIONAL FORMAT: the tariff layout follows Bllink's yearly tariffs table (apartment, tenant name, one column per month).
 * The real Bllink payments export has not been seen yet. The payments layout is our own template. Adjust the aliases when a sample arrives.
 * Rows are numbered as in the spreadsheet: the header is row 1.
 */

export type TariffRow = { row: number; unit: string; month: string; amount: number };
export type PaymentRow = { row: number; unit: string; amount: number; paidAt: string; month: string | null; method: Method; reference: string | null };

const UNIT = ["דירה", "מס' דירה", "מס׳ דירה", "מספר דירה"];
const AMOUNT = ["סכום", "סכום ששולם"];
const PAID_AT = ["תאריך תשלום", "תאריך"];
const MONTH = ["חודש", "חודש חיוב"];
const METHOD = ["אמצעי תשלום", "אמצעי"];
const REFERENCE = ["אסמכתא", "מספר אסמכתא"];

const METHODS: Record<string, Method> = {
  "אשראי": "card", "כרטיס אשראי": "card", "העברה בנקאית": "transfer", "העברה": "transfer",
  "שיק": "check", "צ'ק": "check", "צ׳ק": "check", "מזומן": "cash", "הוראת קבע": "standing_order",
};

const find = (header: string[], names: string[]) => header.findIndex((h) => names.includes(h.trim()));

export function parseTariffSheet(grid: string[][]): { rows: TariffRow[]; problems: Problem[] } {
  const header = grid[0] ?? [];
  const unitCol = find(header, UNIT);
  if (unitCol < 0) return { rows: [], problems: [{ row: 1, column: "דירה", reason: "חסרה עמודה" }] };
  const months = header.map((h, i) => (i === unitCol ? null : parseMonth(h)));
  const rows: TariffRow[] = [];
  const problems: Problem[] = [];
  grid.slice(1).forEach((cells, k) => {
    const row = k + 2;
    const unit = normUnit(cells[unitCol] ?? "");
    if (!unit) return problems.push({ row, column: "דירה", reason: "חסר מספר דירה" });
    months.forEach((month, i) => {
      const cell = (cells[i] ?? "").trim();
      if (!month || cell === "") return;
      const amount = parseAmount(cell);
      if (amount === null || amount < 0) problems.push({ row, column: header[i], reason: "סכום לא תקין" });
      else rows.push({ row, unit, month, amount });
    });
  });
  return { rows, problems };
}

export function parsePaymentsSheet(grid: string[][]): { rows: PaymentRow[]; problems: Problem[] } {
  const header = grid[0] ?? [];
  const col = { unit: find(header, UNIT), amount: find(header, AMOUNT), paidAt: find(header, PAID_AT), month: find(header, MONTH), method: find(header, METHOD), reference: find(header, REFERENCE) };
  const missing: Problem[] = [];
  if (col.unit < 0) missing.push({ row: 1, column: "דירה", reason: "חסרה עמודה" });
  if (col.amount < 0) missing.push({ row: 1, column: "סכום", reason: "חסרה עמודה" });
  if (col.paidAt < 0) missing.push({ row: 1, column: "תאריך תשלום", reason: "חסרה עמודה" });
  if (missing.length) return { rows: [], problems: missing };

  const cell = (cells: string[], i: number) => (i < 0 ? "" : (cells[i] ?? "").trim());
  const rows: PaymentRow[] = [];
  const problems: Problem[] = [];
  grid.slice(1).forEach((cells, k) => {
    const row = k + 2;
    const unit = normUnit(cell(cells, col.unit));
    const amount = parseAmount(cell(cells, col.amount));
    const paidAt = parseDate(cell(cells, col.paidAt));
    const monthText = cell(cells, col.month);
    const month = monthText ? parseMonth(monthText) : null;
    const before = problems.length;
    if (!unit) problems.push({ row, column: "דירה", reason: "חסר מספר דירה" });
    if (amount === null || amount === 0) problems.push({ row, column: "סכום", reason: "סכום לא תקין" });
    if (!paidAt) problems.push({ row, column: "תאריך תשלום", reason: "תאריך לא תקין" });
    if (monthText && !month) problems.push({ row, column: "חודש", reason: "חודש לא תקין" });
    if (problems.length > before) return;
    rows.push({
      row, unit, amount: amount!, paidAt: paidAt!, month,
      method: METHODS[cell(cells, col.method)] ?? "other",
      reference: cell(cells, col.reference) || null,
    });
  });
  return { rows, problems };
}
