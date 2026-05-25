import type { Timestamp } from "firebase/firestore";

const moneyFmt = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 2,
});

export function formatMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return moneyFmt.format(v);
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
