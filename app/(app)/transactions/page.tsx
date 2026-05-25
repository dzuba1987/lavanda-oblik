"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Inbox,
  Pencil,
  Trash2,
  MoreVertical,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityCombobox } from "@/components/EntityCombobox";
import { PeriodFilter } from "@/components/PeriodFilter";
import { TransactionForm } from "@/components/TransactionForm";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  formatDate,
  formatDateLong,
  tsToDate,
} from "@/lib/utils/format";
import { getPeriodRange, type PeriodPreset, type PeriodRange } from "@/lib/utils/period";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listTransactions,
  deleteTransaction,
} from "@/lib/data/transactions";
import { categoriesCrud } from "@/lib/data/categories";
import { productsCrud } from "@/lib/data/products";
import { suppliersCrud } from "@/lib/data/suppliers";
import { customersCrud } from "@/lib/data/customers";
import type {
  Category,
  Customer,
  Product,
  Supplier,
  Transaction,
  TransactionType,
} from "@/lib/data/types";

type TypeFilter = "all" | TransactionType;

export default function TransactionsPage() {
  const { authUser } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [customRange, setCustomRange] = useState<PeriodRange>({
    from: null,
    to: null,
  });
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [defaultType, setDefaultType] = useState<TransactionType>("expense");

  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const range = useMemo(
    () => getPeriodRange(periodPreset, customRange),
    [periodPreset, customRange]
  );

  async function reloadDicts() {
    const [cats, prods, sups, custs] = await Promise.all([
      categoriesCrud.list(),
      productsCrud.list(),
      suppliersCrud.list(),
      customersCrud.list(),
    ]);
    setCategories(cats as Category[]);
    setProducts(prods as Product[]);
    setSuppliers(sups as Supplier[]);
    setCustomers(custs as Customer[]);
  }

  async function reload() {
    setLoading(true);
    try {
      const rows = await listTransactions({
        type: typeFilter === "all" ? undefined : typeFilter,
        categoryId: categoryFilter ?? undefined,
        from: range.from ?? undefined,
        to: range.to ?? undefined,
      });
      setItems(rows);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити транзакції");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadDicts();
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, categoryFilter, periodPreset, customRange.from, customRange.to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      `${t.categoryName} ${t.productName ?? ""} ${t.supplierName ?? ""} ${
        t.customerName ?? ""
      } ${t.note ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === "income") income += t.totalAmount;
      else expense += t.totalAmount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const filteredCategoriesForFilter = useMemo(() => {
    if (typeFilter === "all") return categories;
    return categories.filter((c) => c.type === typeFilter);
  }, [categories, typeFilter]);

  function openCreate(type: TransactionType) {
    setEditing(null);
    setDefaultType(type);
    setFormOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setFormOpen(true);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTransaction(pendingDelete.id);
      toast.success("Запис видалено");
      setPendingDelete(null);
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось видалити");
    } finally {
      setDeleting(false);
    }
  }

  if (!authUser) return null;

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6 pb-24 md:pb-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Транзакції</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}{" "}
            {pluralize(filtered.length, "запис", "записи", "записів")}
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Button
            onClick={() => openCreate("income")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <ArrowDownToLine className="mr-1 h-4 w-4" /> Дохід
          </Button>
          <Button
            onClick={() => openCreate("expense")}
            className="bg-red-600 hover:bg-red-700"
          >
            <ArrowUpFromLine className="mr-1 h-4 w-4" /> Витрата
          </Button>
        </div>
      </header>

      <SummaryCards totals={totals} />

      <div className="flex flex-col gap-2">
        <Tabs
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v as TypeFilter);
            setCategoryFilter(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid">
            <TabsTrigger value="all">Усі</TabsTrigger>
            <TabsTrigger value="income">Доходи</TabsTrigger>
            <TabsTrigger value="expense">Витрати</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative md:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук по категорії, товару, нотатці…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 md:w-56 md:flex-initial">
              <EntityCombobox
                items={filteredCategoriesForFilter.map((c) => ({
                  id: c.id,
                  label: c.name,
                  swatch: c.color,
                }))}
                value={categoryFilter}
                onChange={(id) => setCategoryFilter(id)}
                placeholder="Усі категорії"
              />
            </div>
            <PeriodFilter
              preset={periodPreset}
              custom={customRange}
              onChange={(p, c) => {
                setPeriodPreset(p);
                setCustomRange(c);
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <TransactionListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => openCreate("expense")} />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ key, label, items }) => (
            <div key={key}>
              <div className="mb-1 px-1 text-xs font-medium uppercase text-muted-foreground">
                {label}
              </div>
              <Card>
                <CardContent className="divide-y p-0">
                  {items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      t={t}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setPendingDelete(t)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <FAB onIncome={() => openCreate("income")} onExpense={() => openCreate("expense")} />

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        defaultType={defaultType}
        uid={authUser.uid}
        categories={categories}
        products={products}
        suppliers={suppliers}
        customers={customers}
        onSaved={reload}
        onDictChanged={reloadDicts}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити запис?</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  {pendingDelete.categoryName}
                  {pendingDelete.productName && ` · ${pendingDelete.productName}`}
                  {" · "}
                  {formatMoney(pendingDelete.totalAmount)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Видалити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SummaryCards({
  totals,
}: {
  totals: { income: number; expense: number; net: number };
}) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      <SummaryCard
        label="Доходи"
        value={totals.income}
        color="emerald"
        icon={<ArrowDownToLine className="h-4 w-4" />}
      />
      <SummaryCard
        label="Витрати"
        value={totals.expense}
        color="red"
        icon={<ArrowUpFromLine className="h-4 w-4" />}
      />
      <SummaryCard
        label="Чистий"
        value={totals.net}
        color={totals.net >= 0 ? "violet" : "red"}
        icon={<Receipt className="h-4 w-4" />}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "emerald" | "red" | "violet";
  icon: React.ReactNode;
}) {
  const colorClass = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    red: "text-red-700 dark:text-red-300",
    violet: "text-violet-700 dark:text-violet-300",
  }[color];
  return (
    <Card>
      <CardContent className="px-3 py-3 md:px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={colorClass}>{icon}</span>
          {label}
        </div>
        <div className={cn("mt-1 text-base font-semibold md:text-lg", colorClass)}>
          {formatMoney(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  t,
  onEdit,
  onDelete,
}: {
  t: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = t.type === "income";
  const counterparty = isIncome ? t.customerName : t.supplierName;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            isIncome
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          )}
        >
          {isIncome ? (
            <ArrowDownToLine className="h-4 w-4" />
          ) : (
            <ArrowUpFromLine className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {t.productName ?? t.categoryName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {t.productName ? t.categoryName : counterparty ?? "—"}
            {t.productName && counterparty && ` · ${counterparty}`}
            {(t.quantity > 1 || t.unitPrice !== t.totalAmount) && (
              <> · {t.quantity}×{formatMoney(t.unitPrice)}</>
            )}
          </div>
          {t.note && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground/80">
              {t.note}
            </div>
          )}
        </div>

        <div
          className={cn(
            "shrink-0 text-right text-sm font-semibold",
            isIncome
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          )}
        >
          {isIncome ? "+" : "−"}
          {formatMoney(t.totalAmount)}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Редагувати
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Видалити
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TransactionListSkeleton() {
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-base font-medium">Жодних записів</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Для обраного фільтра нічого не знайдено. Додайте перший запис або
            змініть період.
          </p>
        </div>
        <Button onClick={onCreate} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-1 h-4 w-4" />
          Додати запис
        </Button>
      </CardContent>
    </Card>
  );
}

function FAB({
  onIncome,
  onExpense,
}: {
  onIncome: () => void;
  onExpense: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full bg-violet-600 shadow-lg hover:bg-violet-700 md:hidden"
          aria-label="Додати"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem onClick={onIncome}>
          <ArrowDownToLine className="mr-2 h-4 w-4 text-emerald-600" />
          Дохід
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExpense}>
          <ArrowUpFromLine className="mr-2 h-4 w-4 text-red-600" />
          Витрата
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function groupByDay(items: Transaction[]) {
  const groups = new Map<string, { key: string; label: string; items: Transaction[] }>();
  for (const t of items) {
    const d = tsToDate(t.date);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const label = formatDateLong(d);
    const existing = groups.get(key);
    if (existing) existing.items.push(t);
    else groups.set(key, { key, label, items: [t] });
  }
  return Array.from(groups.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

void formatDate;
