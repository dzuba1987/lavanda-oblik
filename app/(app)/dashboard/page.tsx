"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Percent,
  Camera,
  Clock,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PeriodFilter } from "@/components/PeriodFilter";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { TopProductsChart } from "@/components/charts/TopProductsChart";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  formatNumber,
  tsToDate,
  formatDateTime,
} from "@/lib/utils/format";
import { getPeriodRange, type PeriodPreset, type PeriodRange } from "@/lib/utils/period";
import { useAuth } from "@/lib/auth/AuthContext";
import { listTransactions } from "@/lib/data/transactions";
import { categoriesCrud } from "@/lib/data/categories";
import { bookingsCrud } from "@/lib/data/bookings";
import {
  computeTotals,
  monthlyTrend,
  categoryBreakdown,
  topProducts,
} from "@/lib/analytics";
import type { Booking, Category, Transaction } from "@/lib/data/types";

export default function DashboardPage() {
  const { userDoc } = useAuth();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("year");
  const [customRange, setCustomRange] = useState<PeriodRange>({
    from: null,
    to: null,
  });
  const range = useMemo(
    () => getPeriodRange(periodPreset, customRange),
    [periodPreset, customRange]
  );

  const [periodTx, setPeriodTx] = useState<Transaction[]>([]);
  const [trendTx, setTrendTx] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.color);
    return m;
  }, [categories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const trendFrom = new Date();
        trendFrom.setMonth(trendFrom.getMonth() - 11);
        trendFrom.setDate(1);
        trendFrom.setHours(0, 0, 0, 0);

        const [period, trend, cats, books] = await Promise.all([
          listTransactions({
            from: range.from ?? undefined,
            to: range.to ?? undefined,
          }),
          listTransactions({ from: trendFrom }),
          categoriesCrud.list(),
          bookingsCrud.list(),
        ]);
        if (cancelled) return;
        setPeriodTx(period);
        setTrendTx(trend);
        setCategories(cats as Category[]);
        setBookings(books as Booking[]);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error("Не вдалось завантажити дані");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const totals = useMemo(() => computeTotals(periodTx), [periodTx]);
  const trend = useMemo(() => monthlyTrend(trendTx, 12), [trendTx]);
  const expensesByCategory = useMemo(
    () => categoryBreakdown(periodTx, "expense", categoryColorById),
    [periodTx, categoryColorById]
  );
  const incomesByCategory = useMemo(
    () => categoryBreakdown(periodTx, "income", categoryColorById),
    [periodTx, categoryColorById]
  );
  const top = useMemo(() => topProducts(periodTx, "income", 5), [periodTx]);

  const margin =
    totals.income > 0 ? (totals.net / totals.income) * 100 : null;

  // Зарезервовані години фотосесій за обраний період (не скасовані).
  const sessionStats = useMemo(() => {
    const from = range.from ? range.from.getTime() : -Infinity;
    const to = range.to ? range.to.getTime() : Infinity;
    let minutes = 0;
    let count = 0;
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const d = tsToDate(b.start);
      if (!d) continue;
      const t = d.getTime();
      if (t < from || t > to) continue;
      minutes += b.durationMin || 0;
      count++;
    }
    // Найближчий майбутній (не скасований) запис — поза періодом теж.
    const now = Date.now();
    let next: { date: Date; booking: Booking } | null = null;
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const d = tsToDate(b.start);
      if (!d || d.getTime() < now) continue;
      if (!next || d.getTime() < next.date.getTime()) next = { date: d, booking: b };
    }
    return { hours: minutes / 60, count, next };
  }, [bookings, range.from, range.to]);

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
          {/* Підзаголовок прихований на мобільному — економить висоту. md+ лишається. */}
          <p className="hidden text-sm text-muted-foreground md:block">
            Огляд фінансів{userDoc?.name ? `, ${userDoc.name}` : ""}
          </p>
        </div>
        <PeriodFilter
          preset={periodPreset}
          custom={customRange}
          onChange={(p, c) => {
            setPeriodPreset(p);
            setCustomRange(c);
          }}
        />
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Доходи"
          value={formatMoney(totals.income)}
          sub={`${totals.incomeCount} ${pluralize(totals.incomeCount, "продаж", "продажі", "продажів")}`}
          color="emerald"
          icon={<ArrowDownToLine className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          label="Витрати"
          value={formatMoney(totals.expense)}
          sub={`${totals.expenseCount} ${pluralize(totals.expenseCount, "запис", "записи", "записів")}`}
          color="red"
          icon={<ArrowUpFromLine className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          label="Чистий"
          value={formatMoney(totals.net)}
          sub={
            totals.net >= 0
              ? "у плюсі"
              : "у мінусі"
          }
          color={totals.net >= 0 ? "violet" : "red"}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          label="Маржа"
          value={margin != null ? `${formatNumber(margin)}%` : "—"}
          sub="net / income"
          color={
            margin == null ? "violet" : margin >= 0 ? "violet" : "red"
          }
          icon={<Percent className="h-4 w-4" />}
          loading={loading}
        />
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-violet-600" />
              Фотосесії
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              за період
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <SessionStat
                  icon={<Clock className="h-4 w-4" />}
                  label="Зарезервовано"
                  value={`${formatNumber(sessionStats.hours)} год`}
                />
                <SessionStat
                  icon={<Camera className="h-4 w-4" />}
                  label="Сеансів"
                  value={`${sessionStats.count} ${pluralize(
                    sessionStats.count,
                    "запис",
                    "записи",
                    "записів"
                  )}`}
                />
                <SessionStat
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Найближчий"
                  value={
                    sessionStats.next
                      ? formatDateTime(sessionStats.next.date)
                      : "—"
                  }
                  hint={sessionStats.next?.booking.customerName}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Динаміка по місяцях</CardTitle>
            <Badge variant="secondary" className="font-normal">
              останні 12 міс
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <IncomeExpenseChart data={trend} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Витрати по категоріях</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <CategoryPieChart
                data={expensesByCategory}
                emptyText="Немає витрат за період"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Доходи по категоріях</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <CategoryPieChart
                data={incomesByCategory}
                emptyText="Немає доходів за період"
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Топ-5 товарів за виручкою</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <TopProductsChart
                data={top}
                emptyText="Немає продажів за період"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "emerald" | "red" | "violet";
  icon: React.ReactNode;
  loading?: boolean;
}) {
  const colorClass = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    red: "text-red-700 dark:text-red-300",
    violet: "text-violet-700 dark:text-violet-300",
  }[color];

  return (
    <Card size="sm" className="py-3">
      {/* py-0 — вертикальний відступ дає сам Card (py-3), без подвоєння */}
      <CardContent className="space-y-0.5 px-3 py-0 md:px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={colorClass}>{icon}</span>
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className={cn("text-lg font-semibold md:text-xl", colorClass)}>
            {value}
          </div>
        )}
        {sub && (
          <div className="text-xs text-muted-foreground">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SessionStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-violet-600 dark:text-violet-300">{icon}</span>
        {label}
      </div>
      <div className="truncate text-base font-semibold md:text-lg">{value}</div>
      {hint && (
        <div className="truncate text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
