export type PeriodPreset =
  | "month"
  | "quarter"
  | "year"
  | "all"
  | "custom";

export type PeriodRange = {
  from: Date | null;
  to: Date | null;
};

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: "Цей місяць",
  quarter: "Квартал",
  year: "Цей рік",
  all: "Весь час",
  custom: "Період",
};

export function getPeriodRange(
  preset: PeriodPreset,
  custom: PeriodRange = { from: null, to: null },
  now: Date = new Date()
): PeriodRange {
  switch (preset) {
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from, to };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0);
      const to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      return { from, to };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { from, to };
    }
    case "all":
      return { from: null, to: null };
    case "custom":
      return custom;
  }
}
