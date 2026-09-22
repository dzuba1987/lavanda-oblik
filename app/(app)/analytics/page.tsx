"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { StackedCategoryChart } from "@/components/charts/StackedCategoryChart";
import { SeasonalityHeatmap } from "@/components/charts/SeasonalityHeatmap";
import { TopCounterpartiesChart } from "@/components/charts/TopCounterpartiesChart";
import { listTransactions } from "@/lib/data/transactions";
import { categoriesCrud } from "@/lib/data/categories";
import {
  monthlyTrend,
  stackedByCategory,
  windowStart,
  type TrendWindow,
  seasonalityHeatmap,
  topCounterparties,
} from "@/lib/analytics";
import type { Category, Transaction, TransactionType } from "@/lib/data/types";

/**
 * Вікна аналітики. Тиждень і місяць рахуємо по днях: у місячних buckets вони
 * дали б одну-дві точки, і графік динаміки втратив би сенс.
 */
const WINDOWS = [
  { value: "7d", label: "Останній тиждень", window: { unit: "day", count: 7 } },
  { value: "30d", label: "Останній місяць", window: { unit: "day", count: 30 } },
  { value: "3m", label: "Останні 3 місяці", window: { unit: "month", count: 3 } },
  { value: "6m", label: "Останні 6 місяців", window: { unit: "month", count: 6 } },
  { value: "12m", label: "Останні 12 місяців", window: { unit: "month", count: 12 } },
  { value: "24m", label: "Останні 24 місяці", window: { unit: "month", count: 24 } },
  { value: "36m", label: "Останні 3 роки", window: { unit: "month", count: 36 } },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  window: TrendWindow;
}>;

type WindowValue = (typeof WINDOWS)[number]["value"];

export default function AnalyticsPage() {
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [windowValue, setWindowValue] = useState<WindowValue>("12m");

  const activeWindow = useMemo<TrendWindow>(
    () => WINDOWS.find((w) => w.value === windowValue)!.window,
    [windowValue]
  );
  const [stackType, setStackType] = useState<TransactionType>("expense");

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
        const [tx, cats] = await Promise.all([
          listTransactions(),
          categoriesCrud.list(),
        ]);
        if (cancelled) return;
        setAllTx(tx);
        setCategories(cats as Category[]);
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
  }, []);

  const windowedTx = useMemo(() => {
    // Межу вікна рахує сам analytics-шар, щоб фільтр і buckets не розходились.
    const cutoff = windowStart(activeWindow);
    return allTx.filter((t) => {
      const d = t.date?.toDate ? t.date.toDate() : null;
      return d && d >= cutoff;
    });
  }, [allTx, activeWindow]);

  const trend = useMemo(
    () => monthlyTrend(windowedTx, activeWindow),
    [windowedTx, activeWindow]
  );

  const stacked = useMemo(
    () =>
      stackedByCategory(
        windowedTx,
        stackType,
        activeWindow,
        categoryColorById
      ),
    [windowedTx, stackType, activeWindow, categoryColorById]
  );

  const incomeHeatmap = useMemo(
    () => seasonalityHeatmap(allTx, "income"),
    [allTx]
  );
  const expenseHeatmap = useMemo(
    () => seasonalityHeatmap(allTx, "expense"),
    [allTx]
  );

  const topSuppliers = useMemo(
    () => topCounterparties(windowedTx, "expense", 10),
    [windowedTx]
  );
  const topCustomers = useMemo(
    () => topCounterparties(windowedTx, "income", 10),
    [windowedTx]
  );

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Аналітика</h1>
          <p className="text-sm text-muted-foreground">
            Динаміка, сезонність, контрагенти
          </p>
        </div>
        <Select
          value={windowValue}
          onValueChange={(v) => setWindowValue(v as WindowValue)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((w) => (
              <SelectItem key={w.value} value={w.value}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Лінійна динаміка</CardTitle>
            <Badge variant="secondary" className="font-normal">
              Дохід · Витрата · Чистий
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <LineTrendChart data={trend} />
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Розбивка по категоріях</CardTitle>
            <Tabs
              value={stackType}
              onValueChange={(v) => setStackType(v as TransactionType)}
            >
              <TabsList className="h-8">
                <TabsTrigger value="expense" className="h-6 text-xs">
                  Витрати
                </TabsTrigger>
                <TabsTrigger value="income" className="h-6 text-xs">
                  Доходи
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <StackedCategoryChart
                rows={stacked.rows}
                meta={stacked.meta}
                emptyText={
                  stackType === "expense"
                    ? "Немає витрат у вибраному вікні"
                    : "Немає доходів у вибраному вікні"
                }
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сезонність доходів</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <SeasonalityHeatmap
                data={incomeHeatmap}
                baseColor="emerald"
                emptyText="Поки немає історії доходів"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сезонність витрат</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <SeasonalityHeatmap
                data={expenseHeatmap}
                baseColor="red"
                emptyText="Поки немає історії витрат"
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-700" />
              Топ клієнти
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              у вікні
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonList />
            ) : (
              <TopCounterpartiesChart
                data={topCustomers}
                color="emerald"
                emptyText="Немає продажів"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4 text-red-700" />
              Топ постачальники
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              у вікні
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonList />
            ) : (
              <TopCounterpartiesChart
                data={topSuppliers}
                color="red"
                emptyText="Немає витрат"
              />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
