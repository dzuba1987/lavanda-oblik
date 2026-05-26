"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  ClipboardList,
  Inbox,
  Pencil,
  Trash2,
  MoreVertical,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  PackageCheck,
  Clock3,
  PackageOpen,
  Truck,
  MessageSquare,
  Phone,
} from "lucide-react";
import { DELIVERY_LABELS } from "@/lib/utils/delivery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderForm } from "@/components/OrderForm";
import { cn } from "@/lib/utils";
import { formatMoney, formatDate, tsToDate } from "@/lib/utils/format";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listOrders,
  deleteOrder,
  updateOrderStatus,
  deliverOrder,
} from "@/lib/data/orders";
import { categoriesCrud } from "@/lib/data/categories";
import { productsCrud } from "@/lib/data/products";
import { customersCrud } from "@/lib/data/customers";
import type {
  Category,
  Customer,
  Order,
  OrderStatus,
  Product,
} from "@/lib/data/types";

type StatusFilter = "all" | "active" | OrderStatus;
type SortBy = "status" | "newest" | "deadline_asc" | "deadline_desc";

const SORT_LABEL: Record<SortBy, string> = {
  status: "За статусом (нові згори)",
  newest: "Спочатку нові",
  deadline_asc: "Дата доставки: найближчі",
  deadline_desc: "Дата доставки: найпізніші",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Нове",
  confirmed: "Підтверджено",
  in_progress: "В роботі",
  ready: "Готове",
  delivered: "Виконано",
  cancelled: "Скасовано",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
  confirmed: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  ready: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const STATUS_BORDER: Record<OrderStatus, string> = {
  new: "border-l-sky-500",
  confirmed: "border-l-violet-500",
  in_progress: "border-l-amber-500",
  ready: "border-l-teal-500",
  delivered: "border-l-emerald-500",
  cancelled: "border-l-zinc-400",
};

const STATUS_ORDER: Record<OrderStatus, number> = {
  new: 0,
  in_progress: 1,
  confirmed: 2,
  ready: 3,
  delivered: 4,
  cancelled: 5,
};

const ACTIVE_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "ready",
];

const DEFAULT_ACTIVE_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
];

export default function OrdersPage() {
  const { authUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("status");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pendingDeliver, setPendingDeliver] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  async function reloadDicts() {
    const [cats, prods, custs] = await Promise.all([
      categoriesCrud.list(),
      productsCrud.list(),
      customersCrud.list(),
    ]);
    setCategories(cats as Category[]);
    setProducts(prods as Product[]);
    setCustomers(custs as Customer[]);
  }

  async function reload() {
    setLoading(true);
    try {
      const rows = await listOrders();
      setOrders(rows);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити замовлення");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadDicts();
    reload();
  }, []);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter === "active") {
      list = list.filter((o) => DEFAULT_ACTIVE_STATUSES.includes(o.status));
    } else if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        `${o.customerName ?? ""} ${o.notes ?? ""} ${o.items.map((i) => i.productName).join(" ")}`
          .toLowerCase()
          .includes(q)
      );
    }
    if (sortBy === "status") {
      // Спершу за пріоритетом статусу, далі за датою створення (новіші згори).
      list = [...list].sort((a, b) => {
        const sa = STATUS_ORDER[a.status];
        const sb = STATUS_ORDER[b.status];
        if (sa !== sb) return sa - sb;
        const ad = tsToDate(a.createdAt)?.getTime() ?? 0;
        const bd = tsToDate(b.createdAt)?.getTime() ?? 0;
        return bd - ad;
      });
    } else if (sortBy === "deadline_asc" || sortBy === "deadline_desc") {
      const dir = sortBy === "deadline_asc" ? 1 : -1;
      // Без deadline — завжди в кінці, незалежно від напрямку.
      list = [...list].sort((a, b) => {
        const ad = tsToDate(a.deadline)?.getTime() ?? null;
        const bd = tsToDate(b.deadline)?.getTime() ?? null;
        if (ad === null && bd === null) return 0;
        if (ad === null) return 1;
        if (bd === null) return -1;
        return (ad - bd) * dir;
      });
    }
    return list;
  }, [orders, statusFilter, search, sortBy]);

  const kpi = useMemo(() => {
    const now = new Date();
    let activeCount = 0;
    let activeSum = 0;
    let overdueCount = 0;
    for (const o of orders) {
      if (ACTIVE_STATUSES.includes(o.status)) {
        activeCount++;
        activeSum += o.totalAmount;
        const dl = tsToDate(o.deadline);
        if (dl && dl < now) overdueCount++;
      }
    }
    return { activeCount, activeSum, overdueCount };
  }, [orders]);

  const tabCounts = useMemo(() => {
    const c = {
      all: orders.length,
      active: 0,
      new: 0,
      confirmed: 0,
      in_progress: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      c[o.status]++;
      if (DEFAULT_ACTIVE_STATUSES.includes(o.status)) c.active++;
    }
    return c;
  }, [orders]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(o: Order) {
    setEditing(o);
    setFormOpen(true);
  }

  async function handleStatusChange(o: Order, newStatus: OrderStatus) {
    if (newStatus === "delivered") {
      setPendingDeliver(o);
      return;
    }
    try {
      await updateOrderStatus(o.id, newStatus);
      toast.success("Статус оновлено");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось оновити статус");
    }
  }

  async function handleConfirmDeliver() {
    if (!pendingDeliver || !authUser) return;
    setDelivering(true);
    try {
      const txIds = await deliverOrder(pendingDeliver, new Date(), authUser.uid);
      toast.success(
        `Створено ${txIds.length} ${pluralize(txIds.length, "транзакцію", "транзакції", "транзакцій")}`
      );
      setPendingDeliver(null);
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось видати замовлення");
    } finally {
      setDelivering(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteOrder(pendingDelete.id);
      toast.success("Замовлення видалено");
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
          <h1 className="text-2xl font-semibold tracking-tight">Замовлення</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}{" "}
            {pluralize(filtered.length, "замовлення", "замовлення", "замовлень")}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="hidden bg-violet-600 hover:bg-violet-700 md:inline-flex"
        >
          <Plus className="mr-1 h-4 w-4" /> Замовлення
        </Button>
      </header>

      <KpiRow kpi={kpi} loading={loading} />

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as StatusFilter)}
      >
        <TabsList className="flex w-full justify-start overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>[data-slot=tabs-trigger]]:flex-none [&>[data-slot=tabs-trigger]]:px-3">
          <TabsTrigger value="active">
            Активні<TabCount n={tabCounts.active} />
          </TabsTrigger>
          <TabsTrigger value="new">
            {STATUS_LABEL.new}<TabCount n={tabCounts.new} />
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            {STATUS_LABEL.in_progress}<TabCount n={tabCounts.in_progress} />
          </TabsTrigger>
          <TabsTrigger value="ready">
            {STATUS_LABEL.ready}<TabCount n={tabCounts.ready} />
          </TabsTrigger>
          <TabsTrigger value="delivered">
            {STATUS_LABEL.delivered}<TabCount n={tabCounts.delivered} />
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            {STATUS_LABEL.cancelled}<TabCount n={tabCounts.cancelled} />
          </TabsTrigger>
          <TabsTrigger value="all">
            Усі<TabCount n={tabCounts.all} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук по клієнту, товару, нотатці…"
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="sm:w-[220px]">
            <ArrowUpDown className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">{SORT_LABEL.status}</SelectItem>
            <SelectItem value="newest">{SORT_LABEL.newest}</SelectItem>
            <SelectItem value="deadline_asc">
              {SORT_LABEL.deadline_asc}
            </SelectItem>
            <SelectItem value="deadline_desc">
              {SORT_LABEL.deadline_desc}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onEdit={() => openEdit(o)}
              onDelete={() => setPendingDelete(o)}
              onStatusChange={(s) => handleStatusChange(o, s)}
              onPhotoClick={setLightboxSrc}
            />
          ))}
        </div>
      )}

      <FAB onClick={openCreate} />

      <OrderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        uid={authUser.uid}
        categories={categories}
        products={products}
        customers={customers}
        onSaved={reload}
        onDictChanged={reloadDicts}
      />

      <Dialog
        open={pendingDeliver !== null}
        onOpenChange={(o) => !o && setPendingDeliver(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видати замовлення?</DialogTitle>
            <DialogDescription>
              {pendingDeliver && (
                <>
                  Буде створено{" "}
                  <span className="font-semibold">
                    {pendingDeliver.items.length}{" "}
                    {pluralize(
                      pendingDeliver.items.length,
                      "транзакцію",
                      "транзакції",
                      "транзакцій"
                    )}{" "}
                    доходу
                  </span>{" "}
                  на загальну суму {formatMoney(pendingDeliver.totalAmount)}.
                  Замовлення стане статусом «Виконано».
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDeliver(null)}
              disabled={delivering}
            >
              Скасувати
            </Button>
            <Button
              onClick={handleConfirmDeliver}
              disabled={delivering}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {delivering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Видати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lightboxSrc !== null}
        onOpenChange={(o) => !o && setLightboxSrc(null)}
      >
        <DialogContent
          showCloseButton
          className="max-h-[95vh] max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl"
        >
          <DialogTitle className="sr-only">Перегляд фото</DialogTitle>
          {lightboxSrc && (
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="block w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxSrc}
                alt="Фото замовлення"
                className="max-h-[95vh] w-full rounded-md object-contain"
              />
            </button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити замовлення?</DialogTitle>
            <DialogDescription>
              Цю дію не можна скасувати. Якщо замовлення вже виконане і має
              пов&apos;язані транзакції — вони НЕ будуть видалені.
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

function KpiRow({
  kpi,
  loading,
}: {
  kpi: { activeCount: number; activeSum: number; overdueCount: number };
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <KpiCard
        label="Активні"
        value={loading ? "…" : String(kpi.activeCount)}
        icon={<ClipboardList className="h-4 w-4" />}
        tone="violet"
      />
      <KpiCard
        label="Сума активних"
        value={loading ? "…" : formatMoney(kpi.activeSum)}
        icon={<PackageOpen className="h-4 w-4" />}
        tone="violet"
      />
      <KpiCard
        label="Прострочено"
        value={loading ? "…" : String(kpi.overdueCount)}
        icon={<AlertTriangle className="h-4 w-4" />}
        tone={kpi.overdueCount > 0 ? "red" : "muted"}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "violet" | "red" | "muted";
}) {
  const colorClass = {
    violet: "text-violet-700 dark:text-violet-300",
    red: "text-red-700 dark:text-red-300",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="space-y-1 px-3 py-3 md:px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={colorClass}>{icon}</span>
          {label}
        </div>
        <div className={cn("text-base font-semibold md:text-lg", colorClass)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderCard({
  order,
  onEdit,
  onDelete,
  onStatusChange,
  onPhotoClick,
}: {
  order: Order;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: OrderStatus) => void;
  onPhotoClick: (src: string) => void;
}) {
  const firstItem = order.items[0];
  const restCount = order.items.length - 1;
  const deadlineDate = tsToDate(order.deadline);
  const isOverdue =
    deadlineDate &&
    deadlineDate < new Date() &&
    ACTIVE_STATUSES.includes(order.status);
  const photos = order.photos ?? [];

  return (
    <Card className={cn("border-l-4", STATUS_BORDER[order.status])}>
      <CardContent className="px-4 py-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
          >
            <div className="flex w-full items-center gap-2">
              <Badge
                variant="secondary"
                className={cn("font-normal", STATUS_COLOR[order.status])}
              >
                {STATUS_LABEL[order.status]}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="font-normal">
                  Прострочено
                </Badge>
              )}
              {deadlineDate && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground",
                    isOverdue && "text-red-600 dark:text-red-400"
                  )}
                >
                  <CalendarClock className="h-3 w-3" />
                  {formatDate(deadlineDate)}
                </span>
              )}
              {(order.commentsCount ?? 0) > 0 && (
                <span
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-300"
                  aria-label={`${order.commentsCount} коментарів`}
                >
                  <MessageSquare className="h-3 w-3" />
                  {order.commentsCount}
                </span>
              )}
            </div>

            <div className="text-sm font-medium">
              {order.customerName ?? "(без клієнта)"}
            </div>

            <div className="text-xs text-muted-foreground">
              {firstItem
                ? firstItem.productName
                : "(порожнє)"}
              {restCount > 0 && (
                <span className="text-muted-foreground/70">
                  {" "}
                  + ще {restCount}
                </span>
              )}
              {" · "}
              <span className="font-semibold text-foreground">
                {formatMoney(order.totalAmount)}
              </span>
            </div>

            {order.delivery && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Truck className="h-3 w-3" />
                <span>{DELIVERY_LABELS[order.delivery.method]}</span>
                {order.delivery.trackingNumber && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {order.delivery.trackingNumber}
                  </span>
                )}
              </div>
            )}

            {order.notes && (
              <div className="line-clamp-1 text-xs text-muted-foreground/80">
                {order.notes}
              </div>
            )}
          </button>

          <StatusActions
            order={order}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {order.phone && (
          <a
            href={`tel:${order.phone.replace(/\s/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60"
            aria-label={`Подзвонити ${order.phone}`}
          >
            <Phone className="h-3 w-3" />
            {order.phone}
          </a>
        )}

        {photos.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto">
            {photos.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPhotoClick(src)}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                aria-label={`Фото ${i + 1} з ${photos.length}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusActions({
  order,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  order: Order;
  onStatusChange: (s: OrderStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isActive = ACTIVE_STATUSES.includes(order.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {isActive && (
          <>
            <DropdownMenuLabel className="text-xs">
              Змінити статус
            </DropdownMenuLabel>
            {order.status !== "confirmed" && (
              <DropdownMenuItem onClick={() => onStatusChange("confirmed")}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-violet-600" />
                Підтверджено
              </DropdownMenuItem>
            )}
            {order.status !== "in_progress" && (
              <DropdownMenuItem onClick={() => onStatusChange("in_progress")}>
                <Clock3 className="mr-2 h-4 w-4 text-amber-600" />
                В роботі
              </DropdownMenuItem>
            )}
            {order.status !== "ready" && (
              <DropdownMenuItem onClick={() => onStatusChange("ready")}>
                <PackageCheck className="mr-2 h-4 w-4 text-teal-600" />
                Готове
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onStatusChange("delivered")}>
              <PackageCheck className="mr-2 h-4 w-4 text-emerald-600" />
              Видано → транзакція
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onStatusChange("cancelled")}
              variant="destructive"
            >
              <CircleSlash className="mr-2 h-4 w-4" />
              Скасувати
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Редагувати
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Видалити
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TabCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold tabular-nums text-white shadow-sm dark:bg-violet-500">
      {n}
    </span>
  );
}

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full bg-violet-600 shadow-lg hover:bg-violet-700 md:hidden"
      aria-label="Нове замовлення"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="px-4 py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-base font-medium">Жодних замовлень</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Створіть перше замовлення — наприклад, від замовника майстер-класу
            чи корпоративного клієнта.
          </p>
        </div>
        <Button onClick={onCreate} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-1 h-4 w-4" />
          Нове замовлення
        </Button>
      </CardContent>
    </Card>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
