import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { monthlyTrend, stackedByCategory, windowStart } from "@/lib/analytics";
import type { Transaction } from "@/lib/data/types";

const NOW = new Date(2026, 8, 21, 12, 0, 0); // 21 вересня 2026

function tx(date: Date, type: "income" | "expense", amount: number): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    date: Timestamp.fromDate(date),
    categoryId: "cat1",
    categoryName: "Тест",
    quantity: 1,
    unitPrice: amount,
    totalAmount: amount,
  } as unknown as Transaction;
}

describe("вікна аналітики", () => {
  it("тиждень — 7 денних buckets, останній сьогодні", () => {
    const b = monthlyTrend([], { unit: "day", count: 7 }, NOW);
    expect(b).toHaveLength(7);
    expect(b[0].label).toBe("15.09");
    expect(b[6].label).toBe("21.09");
  });

  it("місяць — 30 денних buckets", () => {
    const b = monthlyTrend([], { unit: "day", count: 30 }, NOW);
    expect(b).toHaveLength(30);
    expect(b[0].label).toBe("23.08");
    expect(b[29].label).toBe("21.09");
  });

  it("3 місяці — 3 місячних buckets", () => {
    const b = monthlyTrend([], { unit: "month", count: 3 }, NOW);
    expect(b).toHaveLength(3);
    expect(b.map((x) => x.label)).toEqual(["Лип 26", "Сер 26", "Вер 26"]);
  });

  it("число за минуле число, а не за старе, лягає у свій день", () => {
    const b = monthlyTrend(
      [tx(new Date(2026, 8, 19, 10), "income", 500), tx(new Date(2026, 8, 21, 9), "expense", 200)],
      { unit: "day", count: 7 },
      NOW
    );
    const d19 = b.find((x) => x.label === "19.09")!;
    const d21 = b.find((x) => x.label === "21.09")!;
    expect(d19.income).toBe(500);
    expect(d21.expense).toBe(200);
    expect(d21.net).toBe(-200);
  });

  it("транзакція поза вікном ігнорується", () => {
    const b = monthlyTrend([tx(new Date(2026, 8, 1), "income", 999)], { unit: "day", count: 7 }, NOW);
    expect(b.reduce((a, x) => a + x.income, 0)).toBe(0);
  });

  it("windowStart: тиждень — опівніч 6 днів тому", () => {
    const s = windowStart({ unit: "day", count: 7 }, NOW);
    expect(s.getDate()).toBe(15);
    expect(s.getMonth()).toBe(8);
    expect(s.getHours()).toBe(0);
  });

  it("windowStart: місяці — перше число", () => {
    const s = windowStart({ unit: "month", count: 3 }, NOW);
    expect(s.getDate()).toBe(1);
    expect(s.getMonth()).toBe(6);
  });

  it("число як раніше означає місяці", () => {
    expect(monthlyTrend([], 6, NOW)).toHaveLength(6);
    expect(windowStart(12, NOW).getMonth()).toBe(9);
  });

  it("stackedByCategory теж вміє дні", () => {
    const { rows } = stackedByCategory(
      [tx(new Date(2026, 8, 20), "expense", 300)],
      "expense",
      { unit: "day", count: 7 },
      new Map([["cat1", "#000"]]),
      NOW
    );
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.label === "20.09")!.cat1).toBe(300);
  });
});
