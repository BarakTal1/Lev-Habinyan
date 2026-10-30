import { parseAmount } from "@/lib/domain/money";
import { isPhone } from "@/lib/phone";
import type { Problem } from "./controlSheet";
import { normUnit } from "./sheet";

/**
 * Parser for the apartments file of the spec: one row per apartment with floor, owner, tenant, phones, emails, who pays and the monthly fee.
 * PROVISIONAL FORMAT: our own template. Bllink's tenant list may use other headers; add aliases when a sample arrives.
 * Rows are numbered as in the spreadsheet: the header is row 1.
 */

export type Contact = { name: string; phone: string | null; email: string | null };
export type ApartmentRow = { row: number; unit: string; floor: string | null; owner: Contact | null; tenant: Contact | null; payer: "owner" | "tenant" | null; fee: number | null };

const ALIASES = {
  unit: ["דירה", "מס' דירה", "מס׳ דירה", "מספר דירה"],
  floor: ["קומה"],
  owner: ["בעלים", "שם בעלים", "בעל הדירה"],
  ownerPhone: ["טלפון בעלים", "נייד בעלים"],
  ownerEmail: ["אימייל בעלים", "מייל בעלים", "דוא\"ל בעלים", "דוא״ל בעלים"],
  tenant: ["שוכר", "שם שוכר", "שוכרים"],
  tenantPhone: ["טלפון שוכר", "נייד שוכר"],
  tenantEmail: ["אימייל שוכר", "מייל שוכר", "דוא\"ל שוכר", "דוא״ל שוכר"],
  payer: ["משלם", "מי משלם"],
  fee: ["דמי ועד", "תשלום חודשי", "תעריף"],
} as const;
const PAYER: Record<string, "owner" | "tenant"> = { "בעלים": "owner", "בעל הדירה": "owner", "שוכר": "tenant", "שוכרים": "tenant" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseApartmentsSheet(grid: string[][]): { rows: ApartmentRow[]; problems: Problem[] } {
  const header = (grid[0] ?? []).map((h) => h.trim());
  const col = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, header.findIndex((h) => (names as readonly string[]).includes(h))])) as Record<keyof typeof ALIASES, number>;
  if (col.unit < 0) return { rows: [], problems: [{ row: 1, column: "דירה", reason: "חסרה עמודה" }] };

  const rows: ApartmentRow[] = [];
  const problems: Problem[] = [];
  grid.slice(1).forEach((cells, k) => {
    const row = k + 2;
    const cell = (i: number) => (i < 0 ? "" : (cells[i] ?? "").trim());
    const unit = normUnit(cell(col.unit));
    if (!unit) return problems.push({ row, column: "דירה", reason: "חסר מספר דירה" });

    const contact = (name: number, phone: number, email: number): Contact | null => {
      if (!cell(name)) return null;
      const p = cell(phone), e = cell(email);
      if (p && !isPhone(p)) problems.push({ row, column: header[phone], reason: "טלפון לא תקין" });
      if (e && !EMAIL.test(e)) problems.push({ row, column: header[email], reason: "אימייל לא תקין" });
      return { name: cell(name), phone: p && isPhone(p) ? p : null, email: e && EMAIL.test(e) ? e : null };
    };
    const owner = contact(col.owner, col.ownerPhone, col.ownerEmail);
    const tenant = contact(col.tenant, col.tenantPhone, col.tenantEmail);

    const payerText = cell(col.payer);
    const payer = payerText ? PAYER[payerText] ?? null : null;
    if (payerText && !payer) problems.push({ row, column: header[col.payer], reason: "ערך לא מוכר (בעלים או שוכר)" });
    const feeText = cell(col.fee);
    const fee = feeText ? parseAmount(feeText) : null;
    if (feeText && (fee === null || fee < 0)) problems.push({ row, column: header[col.fee], reason: "סכום לא תקין" });

    // An apartment with no phone at all is still imported, but the founders must know: the bot cannot reach it.
    if (!owner?.phone && !tenant?.phone && !problems.some((p) => p.row === row && p.column.startsWith("טלפון"))) problems.push({ row, column: "טלפון", reason: "אין טלפון לדירה" });
    rows.push({ row, unit, floor: cell(col.floor) || null, owner, tenant, payer, fee: fee !== null && fee >= 0 ? fee : null });
  });
  return { rows, problems };
}
