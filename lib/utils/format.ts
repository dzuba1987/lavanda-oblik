import type { Timestamp } from "firebase/firestore";

const moneyFmt = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 2,
});

const moneyFmtNoFraction = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 2,
});

export function formatMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return moneyFmt.format(v);
}

/** Сума без копійок — для вузьких місць (мобільні KPI-картки). */
export function formatMoneyCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return moneyFmtNoFraction.format(v);
}

export function formatNumber(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return numberFmt.format(v);
}

const dateFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const dateLongFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const monthFmt = new Intl.DateTimeFormat("uk-UA", {
  month: "long",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function tsToDate(ts: Timestamp | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

export function formatDate(ts: Timestamp | Date | null | undefined): string {
  const d = tsToDate(ts);
  return d ? dateFmt.format(d) : "—";
}

export function formatDateLong(ts: Timestamp | Date | null | undefined): string {
  const d = tsToDate(ts);
  return d ? dateLongFmt.format(d) : "—";
}

/** Дата + час (24h), напр. «07.06.26, 14:30». */
export function formatDateTime(ts: Timestamp | Date | null | undefined): string {
  const d = tsToDate(ts);
  return d ? dateTimeFmt.format(d) : "—";
}

/**
 * Дата, а якщо час не опівночі — ще й час. Зручно для відображення, де
 * дедлайни зберігаються як дата (00:00), а created/delivered мають реальний час.
 */
export function formatDateMaybeTime(
  ts: Timestamp | Date | null | undefined
): string {
  const d = tsToDate(ts);
  if (!d) return "—";
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? dateTimeFmt.format(d) : dateFmt.format(d);
}

export function formatMonth(d: Date): string {
  return monthFmt.format(d);
}

export function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromInputDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

const rtfFmt = new Intl.RelativeTimeFormat("uk-UA", { numeric: "auto" });

/**
 * Відносна дата ("щойно", "5 хв тому", "вчора", "3 дні тому"). Старіше 30 днів —
 * віддає коротку дату формату dd.mm.yy. null/undefined → "—".
 */
export function formatRelative(
  ts: Timestamp | Date | null | undefined
): string {
  const d = tsToDate(ts);
  if (!d) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return "щойно";
  if (diffMin < 60) return rtfFmt.format(-diffMin, "minute");
  if (diffHour < 24) return rtfFmt.format(-diffHour, "hour");
  if (diffDay <= 30) return rtfFmt.format(-diffDay, "day");
  return formatDate(d);
}
