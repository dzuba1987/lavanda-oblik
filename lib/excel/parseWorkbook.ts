import ExcelJS from "exceljs";
import { parseExpensesSheet, parseSalesSheet } from "./parseSheet";
import type { WorkbookParseResult, SheetParseResult } from "./types";

const EXPENSE_PATTERNS = [/^витрати/i, /expenses/i];
const SALES_PATTERNS = [/^продаж/i, /sales/i];
const DICT_PATTERNS = [/^словник/i, /dictionary/i];

export async function parseWorkbook(file: File): Promise<WorkbookParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheets: SheetParseResult[] = [];
  const unknownSheets: string[] = [];
  let totalRows = 0;
  let totalSkipped = 0;

  wb.eachSheet((ws) => {
    const name = ws.name.trim();
    if (matches(name, EXPENSE_PATTERNS)) {
      const result = parseExpensesSheet(ws);
      sheets.push(result);
      totalRows += result.rows.length;
      totalSkipped += result.skipped.length;
    } else if (matches(name, SALES_PATTERNS)) {
      const result = parseSalesSheet(ws);
      sheets.push(result);
      totalRows += result.rows.length;
      totalSkipped += result.skipped.length;
    } else if (matches(name, DICT_PATTERNS)) {
      // Словник наразі ігноруємо як джерело транзакцій;
      // довідники upsert-нуться при імпорті транзакцій
    } else {
      unknownSheets.push(name);
    }
  });

  // Сортуємо аркуші по року в назві (Витрати 2024 → Продажі 2024 → ...)
  sheets.sort((a, b) => {
    const ya = extractYear(a.sheet);
    const yb = extractYear(b.sheet);
    if (ya !== yb) return ya - yb;
    return a.type === b.type ? 0 : a.type === "expense" ? -1 : 1;
  });

  return { sheets, unknownSheets, totalRows, totalSkipped };
}

function matches(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

function extractYear(name: string): number {
  const m = /(\d{4})/.exec(name);
  return m ? Number(m[1]) : 0;
}
