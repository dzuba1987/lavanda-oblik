import type { CellValue } from "exceljs";

/**
 * exceljs повертає різні типи для одної клітинки: Date, number, string, formula result, RichText.
 * Цей хелпер нормалізує до простого string.
 */
export function cellToString(v: CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    // RichText
    if ("richText" in v && Array.isArray((v as { richText: { text: string }[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join("")
        .trim();
    }
    // Formula result
    if ("result" in v && v.result != null) {
      return cellToString(v.result as CellValue);
    }
    if ("text" in v && typeof (v as { text: unknown }).text === "string") {
      return ((v as { text: string }).text).trim();
    }
    // Hyperlink
    if ("hyperlink" in v && typeof (v as { text?: string }).text === "string") {
      return (v as { text: string }).text.trim();
    }
  }
  return String(v).trim();
}

export function cellToNumber(v: CellValue): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[\s ]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return cellToNumber(v.result as CellValue);
    if ("error" in v) return null;
  }
  return null;
}

/**
 * Парсить дату з рядка/числа/Date.
 * Підтримує українські формати: "04.01.26", "04.01.2026", "04/01/26", "2026-01-04", Date об'єкти, Excel serial.
 */
export function cellToDate(v: CellValue): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;

  if (typeof v === "number") {
    // Excel serial date: днів з 1900-01-01 (з історичним багом про 1900 як leap year)
    if (v > 25569 && v < 80000) {
      const ms = (v - 25569) * 86400 * 1000;
      const d = new Date(ms);
      // нормалізуємо до полудня щоб уникнути збоїв таймзони
      d.setUTCHours(12, 0, 0, 0);
      return d;
    }
    return null;
  }

  if (typeof v === "string") {
    return parseDateString(v);
  }

  if (typeof v === "object") {
    if ("result" in v && v.result != null) return cellToDate(v.result as CellValue);
    if ("text" in v && typeof (v as { text: unknown }).text === "string") {
      return parseDateString((v as { text: string }).text);
    }
  }
  return null;
}

function parseDateString(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  // ISO: 2026-01-04
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (iso) {
    return makeDate(+iso[1], +iso[2], +iso[3]);
  }

  // DD.MM.YY або DD.MM.YYYY або DD/MM/YY або DD-MM-YY
  const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/.exec(trimmed);
  if (local) {
    let year = +local[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return makeDate(year, +local[2], +local[1]);
  }

  return null;
}

function makeDate(year: number, month: number, day: number): Date | null {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}
