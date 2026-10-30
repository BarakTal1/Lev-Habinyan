// Reads an uploaded file into a grid of text cells, in the browser. The server never sees the file itself.
import { csvToGrid, decodeCsv } from "./sheet";

/** One spreadsheet cell as text. A date cell becomes YYYY-MM-DD, which the sheet parsers read. */
export function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

/** .xlsx through read-excel-file (first sheet); anything else as CSV in UTF-8 or Windows-1255. */
export async function readGrid(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((r) => r.map(cellText)).filter((r) => r.some((c) => c !== ""));
  }
  return csvToGrid(decodeCsv(new Uint8Array(await file.arrayBuffer())));
}
