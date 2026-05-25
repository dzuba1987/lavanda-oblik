import type { Worksheet } from "exceljs";
import { cellToString, cellToNumber, cellToDate } from "./parseCell";
import type { ParsedRow, SheetParseResult, SkippedRow } from "./types";
import type { TransactionType } from "@/lib/data/types";

const DEFAULT_INCOME_CATEGORY = "Продукція";

type ColumnMap = {
  date: number;
  counterparty: number;
  category: number;
  product: number;
  price: number;
  quantity: number;
  total: number;
  note?: number;
  source?: number;
  age?: number;
};

const EXPENSE_COLUMNS: ColumnMap = {
  date: 1,
  counterparty: 2,
  category: 3,
  product: 4,
  price: 5,
  quantity: 6,
  total: 7,
  note: 8,
};

const SALES_COLUMNS: ColumnMap = {
  date: 1,
  counterparty: 2,
  category: 3,
  product: 4,
  price: 5,
  quantity: 6,
  total: 7,
  source: 8,
  age: 9,
};

export function parseExpensesSheet(sheet: Worksheet): SheetParseResult {
  return parseSheet(sheet, "expense", EXPENSE_COLUMNS);
}

export function parseSalesSheet(sheet: Worksheet): SheetParseResult {
  return parseSheet(sheet, "income", SALES_COLUMNS);
}

function parseSheet(
  sheet: Worksheet,
  type: TransactionType,
  cols: ColumnMap
): SheetParseResult {
  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];

  // Контекст для merged cells — попередні значення «успадковуються»
  let currentDate: Date | null = null;
  let currentCounterparty: string | null = null;
  let currentCategory: string | null = null;

  const headerRowNumber = findHeaderRow(sheet);
  const lastRow = sheet.actualRowCount || sheet.rowCount;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (!row || row.cellCount === 0) continue;

    const rawDate = row.getCell(cols.date).value;
    const rawCounterparty = cellToString(row.getCell(cols.counterparty).value);
    const rawCategory = cellToString(row.getCell(cols.category).value);
    const rawProduct = cellToString(row.getCell(cols.product).value);
    const rawPrice = row.getCell(cols.price).value;
    const rawQuantity = row.getCell(cols.quantity).value;
    const rawTotal = row.getCell(cols.total).value;

    const parsedDate = cellToDate(rawDate);
    if (parsedDate) currentDate = parsedDate;
    if (rawCounterparty) currentCounterparty = rawCounterparty;
    if (rawCategory) currentCategory = rawCategory;

    // Якщо нема product — пропускаємо: значить це порожній рядок або заголовок
    if (!rawProduct) continue;

    const raw: Record<string, unknown> = {
      date: rawDate,
      counterparty: rawCounterparty,
      category: rawCategory,
      product: rawProduct,
      price: rawPrice,
      quantity: rawQuantity,
      total: rawTotal,
    };

    if (!currentDate) {
      skipped.push({
        sheet: sheet.name,
        rowNumber,
        reason: "Не вдалось визначити дату",
        raw,
      });
      continue;
    }

    const warnings: string[] = [];

    // Категорія: для витрат обов'язкова, для доходів — fallback
    let categoryName = currentCategory;
    if (!categoryName) {
      if (type === "income") {
        categoryName = DEFAULT_INCOME_CATEGORY;
        warnings.push(`Категорію не вказано, використано «${DEFAULT_INCOME_CATEGORY}»`);
      } else {
        skipped.push({
          sheet: sheet.name,
          rowNumber,
          reason: "Не вказано категорію витрат",
          raw,
        });
        continue;
      }
    }

    let unitPrice = cellToNumber(rawPrice);
    let quantity = cellToNumber(rawQuantity);
    const totalFromCell = cellToNumber(rawTotal);

    // Якщо ціна або кількість пусті — спробуємо відновити з total
    if (unitPrice == null && quantity != null && totalFromCell != null && quantity !== 0) {
      unitPrice = totalFromCell / quantity;
      warnings.push("Ціну обчислено зі суми та кількості");
    }
    if (quantity == null && unitPrice != null && totalFromCell != null && unitPrice !== 0) {
      quantity = totalFromCell / unitPrice;
      warnings.push("Кількість обчислено зі суми та ціни");
    }

    if (unitPrice == null) unitPrice = totalFromCell ?? 0;
    if (quantity == null) quantity = totalFromCell != null ? 1 : 0;

    if (unitPrice < 0 || quantity < 0) {
      skipped.push({
        sheet: sheet.name,
        rowNumber,
        reason: "Від'ємна ціна або кількість",
        raw,
      });
      continue;
    }

    // Сума: пріоритет — комірка G, fallback — price * quantity
    let totalAmount = totalFromCell;
    if (totalAmount == null || Number.isNaN(totalAmount)) {
      totalAmount = unitPrice * quantity;
      if (rawTotal != null && rawTotal !== "") {
        warnings.push("Помилка в комірці суми, перерахували з ціни × кількості");
      }
    }

    if (!totalAmount || !Number.isFinite(totalAmount)) {
      skipped.push({
        sheet: sheet.name,
        rowNumber,
        reason: "Сума = 0 або невалідна",
        raw,
      });
      continue;
    }

    const note = cols.note
      ? cellToString(row.getCell(cols.note).value) || null
      : null;

    rows.push({
      type,
      sheet: sheet.name,
      rowNumber,
      date: currentDate,
      categoryName,
      productName: rawProduct || null,
      counterpartyName: currentCounterparty || null,
      unitPrice,
      quantity,
      totalAmount,
      note,
      warnings,
    });
  }

  return { sheet: sheet.name, type, rows, skipped };
}

/**
 * Знаходить рядок із заголовками за наявністю слова «Дата» в перших клітинках.
 * Якщо не знайдено — повертає 1 (тобто парсимо з другого рядка).
 */
function findHeaderRow(sheet: Worksheet): number {
  const maxScan = Math.min(5, sheet.rowCount);
  for (let r = 1; r <= maxScan; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 3; c++) {
      const v = cellToString(row.getCell(c).value).toLowerCase();
      if (v.includes("дата")) return r;
    }
  }
  return 1;
}
