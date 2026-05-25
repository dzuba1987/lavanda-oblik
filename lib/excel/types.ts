import type { TransactionType } from "@/lib/data/types";

/** Один рядок із аркуша, готовий до завантаження. */
export type ParsedRow = {
  type: TransactionType;
  sheet: string;
  rowNumber: number;
  date: Date;
  categoryName: string;
  productName: string | null;
  counterpartyName: string | null;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  note: string | null;
  warnings: string[];
};

export type SkippedRow = {
  sheet: string;
  rowNumber: number;
  reason: string;
  raw: Record<string, unknown>;
};

export type SheetParseResult = {
  sheet: string;
  type: TransactionType;
  rows: ParsedRow[];
  skipped: SkippedRow[];
};

export type WorkbookParseResult = {
  sheets: SheetParseResult[];
  /** Назви знайдених аркушів, які НЕ розпізнані як Витрати/Продажі/Словник */
  unknownSheets: string[];
  totalRows: number;
  totalSkipped: number;
};

export type DictionaryEntry = {
  name: string;
  kind: "category" | "product" | "supplier" | "source";
};

export type DictionaryParseResult = {
  sheet: string;
  entries: DictionaryEntry[];
};
