import type { Transaction, TransactionType } from "@/lib/data/types";
import { tsToDate } from "@/lib/utils/format";

export type Totals = {
  income: number;
  expense: number;
  net: number;
  count: number;
  incomeCount: number;
  expenseCount: number;
};

export function computeTotals(transactions: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const t of transactions) {
    if (t.type === "income") {
      income += t.totalAmount;
      incomeCount++;
    } else {
      expense += t.totalAmount;
      expenseCount++;
    }
  }
  return {
    income,
    expense,
    net: income - expense,
    count: transactions.length,
    incomeCount,
    expenseCount,
  };
}

export type MonthlyBucket = {
  key: string; // "2026-03"
  label: string; // "Бер 26"
  income: number;
  expense: number;
  net: number;
};

const MONTH_SHORT = [
  "Січ",
  "Лют",
  "Бер",
  "Кві",
  "Тра",
  "Чер",
  "Лип",
  "Сер",
  "Вер",
  "Жов",
  "Лис",
  "Гру",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

/**
 * Вікно аналітики. Місячні buckets годяться від кварталу й далі; для тижня
 * чи місяця вони дали б одну-дві точки, тому там крок — день.
 */
export type TrendWindow = { unit: "month" | "day"; count: number };

function toWindow(w: number | TrendWindow): TrendWindow {
  return typeof w === "number" ? { unit: "month", count: w } : w;
}

/** Початок вікна: перше число N-го місяця тому, або опівніч N-го дня тому. */
export function windowStart(w: number | TrendWindow, now: Date = new Date()): Date {
  const { unit, count } = toWindow(w);
  if (unit === "day") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - count + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth() - count + 1, 1);
}

/** Порожні buckets вікна — по одному на крок, у хронологічному порядку. */
function windowSlots(
  w: number | TrendWindow,
  now: Date
): { key: string; label: string }[] {
  const { unit, count } = toWindow(w);
  const start = windowStart(w, now);
  const slots: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d =
      unit === "day"
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
        : new Date(start.getFullYear(), start.getMonth() + i, 1);
    slots.push(
      unit === "day"
        ? { key: dayKey(d), label: dayLabel(d) }
        : { key: monthKey(d), label: monthLabel(d) }
    );
  }
  return slots;
}

function slotKey(d: Date, unit: TrendWindow["unit"]): string {
  return unit === "day" ? dayKey(d) : monthKey(d);
}

/**
 * Повертає масив місячних buckets за останні N місяців (включно з поточним),
 * заповнюючи нулями місяці без транзакцій.
 */
export function monthlyTrend(
  transactions: Transaction[],
  window: number | TrendWindow = 12,
  now: Date = new Date()
): MonthlyBucket[] {
  const { unit } = toWindow(window);
  const buckets = new Map<string, MonthlyBucket>();
  for (const slot of windowSlots(window, now)) {
    buckets.set(slot.key, {
      key: slot.key,
      label: slot.label,
      income: 0,
      expense: 0,
      net: 0,
    });
  }

  for (const t of transactions) {
    const d = tsToDate(t.date);
    if (!d) continue;
    const key = slotKey(d, unit);
    const b = buckets.get(key);
    if (!b) continue;
    if (t.type === "income") b.income += t.totalAmount;
    else b.expense += t.totalAmount;
    b.net = b.income - b.expense;
  }

  return Array.from(buckets.values());
}

export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  color: string;
  value: number;
  percent: number;
};

export function categoryBreakdown(
  transactions: Transaction[],
  type: TransactionType,
  categoryColorById: Map<string, string>
): CategoryBreakdownItem[] {
  const sums = new Map<string, { name: string; value: number }>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== type) continue;
    total += t.totalAmount;
    const key = t.categoryId;
    const existing = sums.get(key);
    if (existing) existing.value += t.totalAmount;
    else sums.set(key, { name: t.categoryName, value: t.totalAmount });
  }

  return Array.from(sums.entries())
    .map(([categoryId, { name, value }]) => ({
      categoryId,
      name,
      color: categoryColorById.get(categoryId) ?? "#94a3b8",
      value,
      percent: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export type ProductRanking = {
  productId: string;
  name: string;
  value: number;
  quantity: number;
  count: number;
};

/**
 * Авто-створена транзакція доставки з замовлення: productId завжди null,
 * productName рівно "Доставка". Виключаємо її з рейтингів товарів, щоб
 * "Доставка" не з'являлась у Топ-N і не спотворювала аналітику продажів.
 */
function isDeliveryTransaction(t: Transaction): boolean {
  return t.productId === null && t.productName === "Доставка";
}

export function topProducts(
  transactions: Transaction[],
  type: TransactionType,
  limit = 5
): ProductRanking[] {
  const map = new Map<string, ProductRanking>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    if (isDeliveryTransaction(t)) continue;
    const id = t.productId ?? "__no-product__";
    const name = t.productName ?? "(без товару)";
    const existing = map.get(id);
    if (existing) {
      existing.value += t.totalAmount;
      existing.quantity += t.quantity;
      existing.count++;
    } else {
      map.set(id, {
        productId: id,
        name,
        value: t.totalAmount,
        quantity: t.quantity,
        count: 1,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export type CounterpartyRanking = {
  id: string;
  name: string;
  value: number;
  count: number;
};

/**
 * Топ постачальників (для type=expense) або клієнтів (для type=income).
 */
export function topCounterparties(
  transactions: Transaction[],
  type: TransactionType,
  limit = 10
): CounterpartyRanking[] {
  const map = new Map<string, CounterpartyRanking>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    const id =
      (type === "expense" ? t.supplierId : t.customerId) ?? "__none__";
    const name =
      (type === "expense" ? t.supplierName : t.customerName) ?? "(невідомий)";
    const existing = map.get(id);
    if (existing) {
      existing.value += t.totalAmount;
      existing.count++;
    } else {
      map.set(id, { id, name, value: t.totalAmount, count: 1 });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export type StackedCategoryRow = {
  key: string;
  label: string;
} & Record<string, string | number>;

export type StackedCategoryMeta = {
  categoryId: string;
  name: string;
  color: string;
};

/**
 * Дані для stacked-bar чарту: по осі X — кроки вікна (місяці або дні),
 * кожна категорія — окрема серія.
 */
export function stackedByCategory(
  transactions: Transaction[],
  type: TransactionType,
  window: number | TrendWindow,
  categoryColorById: Map<string, string>,
  now: Date = new Date()
): { rows: StackedCategoryRow[]; meta: StackedCategoryMeta[] } {
  const { unit } = toWindow(window);
  const buckets = new Map<string, StackedCategoryRow>();
  for (const slot of windowSlots(window, now)) {
    buckets.set(slot.key, { key: slot.key, label: slot.label });
  }

  const seenCategories = new Map<string, StackedCategoryMeta>();
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (t.type !== type) continue;
    const d = tsToDate(t.date);
    if (!d) continue;
    const key = slotKey(d, unit);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const catId = t.categoryId;
    bucket[catId] = ((bucket[catId] as number) ?? 0) + t.totalAmount;
    totals.set(catId, (totals.get(catId) ?? 0) + t.totalAmount);
    if (!seenCategories.has(catId)) {
      seenCategories.set(catId, {
        categoryId: catId,
        name: t.categoryName,
        color: categoryColorById.get(catId) ?? "#94a3b8",
      });
    }
  }

  const meta = Array.from(seenCategories.values()).sort(
    (a, b) => (totals.get(b.categoryId) ?? 0) - (totals.get(a.categoryId) ?? 0)
  );

  return { rows: Array.from(buckets.values()), meta };
}

export type HeatmapCell = {
  year: number;
  month: number; // 0-11
  value: number;
};

export type HeatmapData = {
  years: number[];
  cells: HeatmapCell[];
  max: number;
};

/**
 * Згрупувати суми по (рік, місяць) для heatmap-у сезонності.
 */
export function seasonalityHeatmap(
  transactions: Transaction[],
  type: TransactionType
): HeatmapData {
  const cellMap = new Map<string, HeatmapCell>();
  const years = new Set<number>();
  let max = 0;

  for (const t of transactions) {
    if (t.type !== type) continue;
    const d = tsToDate(t.date);
    if (!d) continue;
    const year = d.getFullYear();
    const month = d.getMonth();
    years.add(year);
    const key = `${year}-${month}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.value += t.totalAmount;
      if (existing.value > max) max = existing.value;
    } else {
      const cell: HeatmapCell = { year, month, value: t.totalAmount };
      cellMap.set(key, cell);
      if (cell.value > max) max = cell.value;
    }
  }

  return {
    years: Array.from(years).sort((a, b) => a - b),
    cells: Array.from(cellMap.values()),
    max,
  };
}

export const MONTH_SHORT_LABELS = MONTH_SHORT;
