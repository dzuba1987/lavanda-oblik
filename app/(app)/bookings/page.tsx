"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Plus,
  Trash2,
  Banknote,
  CreditCard,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityCombobox } from "@/components/EntityCombobox";
import { bookingsCrud } from "@/lib/data/bookings";
import { clearOrderBookingLink, updateOrderPayment } from "@/lib/data/orders";
import { customersCrud } from "@/lib/data/customers";
import { currentAudit } from "@/lib/data/audit";
import { notifyNewBooking } from "@/lib/notify/telegram";
import type {
  Booking,
  BookingStatus,
  Customer,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/data/types";
import { tsToDate, formatDateTime } from "@/lib/utils/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/utils/payment";

// ── Конфіг ──────────────────────────────────────────────────────────────
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);
const PX_PER_HOUR = 56;

const STATUS_META: Record<
  BookingStatus,
  { label: string; cls: string; dot: string }
> = {
  tentative: {
    label: "Попередній",
    cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "Підтверджено",
    cls: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
  },
  done: {
    label: "Завершено",
    cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Скасовано",
    cls: "bg-zinc-100 text-zinc-500 border-zinc-300 line-through dark:bg-zinc-900 dark:text-zinc-500",
    dot: "bg-zinc-400",
  },
};

// ── Хелпери дат ───────────────────────────────────────────────────────────
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function topPx(d: Date) {
  const mins = (d.getHours() - START_HOUR) * 60 + d.getMinutes();
  return (mins / 60) * PX_PER_HOUR;
}

/** Date → "YYYY-MM-DDTHH:mm" для <input type="datetime-local"> (локальний час). */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dayFmt = new Intl.DateTimeFormat("uk-UA", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const monthFmt = new Intl.DateTimeFormat("uk-UA", {
  month: "long",
  year: "numeric",
});

// ─────────────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  // useSearchParams потребує Suspense-межі.
  return (
    <Suspense fallback={null}>
      <BookingsView />
    </Suspense>
  );
}

function BookingsView() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Підсвітити запис на 4с (із самоочисткою попереднього таймера).
  const flashHighlight = useCallback((id: string | null) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightId(id);
    if (id)
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 4000);
  }, []);

  // Вибір дня в календарі: відкрити день і одразу сфокусувати перший
  // (найраніший) не скасований запис, якщо такий є.
  function selectDay(d: Date) {
    setDay(d);
    const first = bookings
      .map((b) => ({ b, s: tsToDate(b.start) }))
      .filter((x) => x.s && sameDay(x.s, d) && x.b.status !== "cancelled")
      .sort((a, b) => a.s!.getTime() - b.s!.getTime())[0];
    flashHighlight(first?.b.id ?? null);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [presetStart, setPresetStart] = useState<Date | null>(null);

  async function reload() {
    const [bs, cs] = await Promise.all([
      bookingsCrud.list(),
      customersCrud.list(),
    ]);
    setBookings(bs as Booking[]);
    setCustomers(cs as Customer[]);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bs, cs] = await Promise.all([
          bookingsCrud.list(),
          customersCrud.list(),
        ]);
        if (!alive) return;
        setBookings(bs as Booking[]);
        setCustomers(cs as Customer[]);
      } catch (e) {
        console.error(e);
        toast.error("Не вдалося завантажити записи");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Перехід за посиланням з Telegram (?id=...): відкрити день запису й підсвітити.
  useEffect(() => {
    if (!focusId || loading || focusedRef.current) return;
    const b = bookings.find((x) => x.id === focusId);
    if (!b) return;
    const d = tsToDate(b.start);
    if (d) {
      const day0 = new Date(d);
      day0.setHours(0, 0, 0, 0);
      setDay(day0);
    }
    focusedRef.current = true;
    flashHighlight(focusId);
  }, [focusId, loading, bookings, flashHighlight]);

  // Чистка таймера при анмаунті.
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const dayItems = useMemo(() => {
    return bookings
      .map((b) => ({ b, start: tsToDate(b.start) }))
      .filter((x) => x.start && sameDay(x.start, day))
      .sort((a, b) => a.start!.getTime() - b.start!.getTime());
  }, [bookings, day]);

  // Швидка зміна оплати з таймлайну. Якщо запис пов'язаний із замовленням —
  // синхронізуємо оплату й там, щоб не розходились.
  async function setBookingPayment(
    b: Booking,
    status: PaymentStatus,
    method: PaymentMethod | null
  ) {
    const pm = status === "paid" ? method : null;
    try {
      await bookingsCrud.update(b.id, {
        paymentStatus: status,
        paymentMethod: pm,
      });
      if (b.orderId) {
        await updateOrderPayment(b.orderId, status, pm).catch((e) =>
          console.warn("order payment sync failed", e)
        );
      }
      toast.success("Оплату оновлено");
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося оновити оплату");
    }
  }

  function openNew(at?: Date) {
    setEditing(null);
    setPresetStart(at ?? null);
    setFormOpen(true);
  }
  function openEdit(b: Booking) {
    setEditing(b);
    setPresetStart(null);
    setFormOpen(true);
  }

  const activeCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return bookings.filter((b) => {
      const d = tsToDate(b.start);
      return (
        d &&
        d >= startOfToday &&
        (b.status === "tentative" || b.status === "confirmed")
      );
    }).length;
  }, [bookings]);

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6 pb-24 md:pb-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Фотосесії</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} {pluralizeBookings(activeCount)}
          </p>
        </div>
        <Button
          onClick={() => openNew()}
          className="bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="mr-1 h-4 w-4" /> Запис
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <MiniMonth selected={day} onSelect={selectDay} bookings={bookings} />
          <div className="mt-3 space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Легенда</p>
            {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span
                  className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[s].dot)}
                />
                {STATUS_META[s].label}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <DayNav day={day} onChange={setDay} count={dayItems.length} />
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Timeline
              items={dayItems.map((x) => x.b)}
              highlightId={highlightId}
              onSlotClick={(h) => {
                const at = new Date(day);
                at.setHours(h, 0, 0, 0);
                openNew(at);
              }}
              onBookingClick={openEdit}
              onSetPayment={setBookingPayment}
            />
          )}
        </Card>
      </div>

      <BookingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        presetStart={presetStart}
        customers={customers}
        bookings={bookings}
        onSaved={reload}
      />
    </main>
  );
}

function pluralizeBookings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "активний запис";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return "активні записи";
  return "активних записів";
}

// ── Денна навігація ────────────────────────────────────────────────────────
function DayNav({
  day,
  onChange,
  count,
}: {
  day: Date;
  onChange: (d: Date) => void;
  count: number;
}) {
  const shift = (n: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + n);
    onChange(d);
  };
  const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    onChange(d);
  };
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={today}>
          Сьогодні
        </Button>
        <span className="ml-1 font-medium capitalize">{dayFmt.format(day)}</span>
      </div>
      <Badge variant="secondary">{count} записів</Badge>
    </div>
  );
}

function bookingPaymentLabel(b: Booking): string {
  if (b.paymentStatus === "paid") {
    return b.paymentMethod
      ? `Оплачено · ${PAYMENT_METHOD_LABEL[b.paymentMethod].toLowerCase()}`
      : "Оплачено";
  }
  return "Не оплачено";
}

/**
 * Клікабельний бейдж оплати на блоці — ті ж тексти/кольори/меню, що в
 * замовленнях. Дозволяє швидко змінити оплату прямо з таймлайну.
 */
function PaymentBadge({
  b,
  onSetPayment,
}: {
  b: Booking;
  onSetPayment: (
    b: Booking,
    status: PaymentStatus,
    method: PaymentMethod | null
  ) => void;
}) {
  const paid = b.paymentStatus === "paid";
  const Icon = paid
    ? b.paymentMethod === "card"
      ? CreditCard
      : Banknote
    : CircleAlert;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "ml-auto inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium ring-1 transition-colors",
            paid
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50"
              : "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/50"
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {bookingPaymentLabel(b)}
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">Оплата</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onSetPayment(b, "paid", "cash")}>
          <Banknote className="mr-2 h-4 w-4 text-emerald-600" />
          Оплачено · готівка
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSetPayment(b, "paid", "card")}>
          <CreditCard className="mr-2 h-4 w-4 text-sky-600" />
          Оплачено · картка
        </DropdownMenuItem>
        {paid && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSetPayment(b, "unpaid", null)}>
              <CircleAlert className="mr-2 h-4 w-4 text-amber-600" />
              Зняти оплату
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Денний таймлайн ─────────────────────────────────────────────────────────
function Timeline({
  items,
  highlightId,
  onSlotClick,
  onBookingClick,
  onSetPayment,
}: {
  items: Booking[];
  highlightId: string | null;
  onSlotClick: (hour: number) => void;
  onBookingClick: (b: Booking) => void;
  onSetPayment: (
    b: Booking,
    status: PaymentStatus,
    method: PaymentMethod | null
  ) => void;
}) {
  const totalH = HOURS.length * PX_PER_HOUR;
  // Скрол до підсвіченого запису, коли він з'являється у DOM.
  const scrollToHi = useCallback((node: HTMLElement | null) => {
    if (node)
      node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  return (
    <div className="relative flex overflow-hidden">
      <div className="w-14 shrink-0 border-r text-right">
        {HOURS.map((h) => (
          <div
            key={h}
            style={{ height: PX_PER_HOUR }}
            className="relative pr-2 text-[11px] tabular-nums text-muted-foreground"
          >
            <span className="absolute -top-1.5 right-2">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>

      <div className="relative flex-1" style={{ height: totalH }}>
        {HOURS.map((h, i) => (
          <button
            key={h}
            onClick={() => onSlotClick(h)}
            style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}
            className="group absolute inset-x-0 border-b border-dashed border-border/60 transition-colors hover:bg-violet-50/60 dark:hover:bg-violet-950/20"
          >
            <Plus className="absolute right-2 top-1.5 h-3.5 w-3.5 text-violet-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}

        {items.map((b) => {
          const start = tsToDate(b.start);
          if (!start) return null;
          const end = new Date(start.getTime() + b.durationMin * 60000);
          const meta = STATUS_META[b.status];
          const h = (b.durationMin / 60) * PX_PER_HOUR;
          const isHi = b.id === highlightId;
          return (
            <div
              key={b.id}
              ref={isHi ? scrollToHi : undefined}
              role="button"
              tabIndex={0}
              onClick={() => onBookingClick(b)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBookingClick(b);
                }
              }}
              style={{ top: topPx(start), height: Math.max(h, 22) }}
              className={cn(
                "absolute left-1 right-2 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
                meta.cls,
                isHi &&
                  "z-10 ring-2 ring-violet-500 ring-offset-2 ring-offset-background animate-pulse"
              )}
            >
              <div className="flex items-center gap-1">
                <span className="truncate font-medium">{b.customerName}</span>
                <PaymentBadge b={b} onSetPayment={onSetPayment} />
              </div>
              <div className="flex items-center gap-1 opacity-80">
                <Clock className="h-3 w-3" />
                {hhmm(start)}–{hhmm(end)}
                {b.type ? ` · ${b.type}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Міні-календар місяця ─────────────────────────────────────────────────────
function MiniMonth({
  selected,
  onSelect,
  bookings,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  bookings: Booking[];
}) {
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1)
  );

  // Тримаємо курсор синхронним з обраним днем (клік у календарі іншого місяця).
  useEffect(() => {
    setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selected]);

  const firstWd =
    (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0
  ).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstWd).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)
    ),
  ];

  const busyDays = useMemo(() => {
    const set = new Set<number>();
    for (const b of bookings) {
      const d = tsToDate(b.start);
      if (
        d &&
        d.getMonth() === cursor.getMonth() &&
        d.getFullYear() === cursor.getFullYear()
      )
        set.add(d.getDate());
    }
    return set;
  }, [bookings, cursor]);

  const shiftMonth = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  const todayD = new Date();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">
          {monthFmt.format(cursor)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, todayD);
          const busy = busyDays.has(d.getDate());
          return (
            <button
              key={i}
              onClick={() => {
                const pick = new Date(d);
                pick.setHours(0, 0, 0, 0);
                onSelect(pick);
              }}
              className={cn(
                "relative aspect-square rounded-md text-xs transition-colors",
                isSel
                  ? "bg-violet-600 text-white"
                  : isToday
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50"
                  : "hover:bg-accent"
              )}
            >
              {d.getDate()}
              {busy && !isSel && (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Форма запису ──────────────────────────────────────────────────────────
const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240];

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h > 0 ? `${h} год` : "", m > 0 ? `${m} хв` : ""]
    .filter(Boolean)
    .join(" ");
}

function BookingFormDialog({
  open,
  onOpenChange,
  editing,
  presetStart,
  customers,
  bookings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Booking | null;
  presetStart: Date | null;
  customers: Customer[];
  bookings: Booking[];
  onSaved: () => Promise<void> | void;
}) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [startStr, setStartStr] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [status, setStatus] = useState<BookingStatus>("tentative");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);

  const allCustomers = useMemo(() => {
    const seen = new Set(customers.map((c) => c.id));
    return [...localCustomers.filter((c) => !seen.has(c.id)), ...customers];
  }, [customers, localCustomers]);

  // Заповнення форми при відкритті.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const s = tsToDate(editing.start);
      setCustomerId(editing.customerId);
      setCustomerName(editing.customerName);
      setPhone(editing.phone ?? "");
      setStartStr(s ? toLocalInput(s) : "");
      setDurationMin(editing.durationMin);
      setStatus(editing.status);
      setType(editing.type ?? "");
      setPrice(editing.price != null ? String(editing.price) : "");
      setPaymentStatus(editing.paymentStatus ?? "unpaid");
      setPaymentMethod(editing.paymentMethod ?? "cash");
      setNotes(editing.notes ?? "");
    } else {
      setCustomerId(null);
      setCustomerName("");
      setPhone("");
      setStartStr(presetStart ? toLocalInput(presetStart) : "");
      setDurationMin(60);
      setStatus("tentative");
      setType("");
      setPrice("");
      setPaymentStatus("unpaid");
      setPaymentMethod("cash");
      setNotes("");
    }
    setLocalCustomers([]);
    // presetStart/editing навмисно поза deps окрім open — щоб не скидати
    // введене під час редагування поля.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function createCustomerInline(label: string) {
    const id = await customersCrud.create({
      name: label,
      age: null,
      source: null,
      phone: null,
      notes: null,
    });
    const fresh: Customer = {
      id,
      name: label,
      age: null,
      source: null,
      phone: null,
      notes: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
    };
    setLocalCustomers((p) => [fresh, ...p]);
    return { id, label };
  }

  async function handleSave() {
    const start = fromLocalInput(startStr);
    if (!start) {
      toast.error("Вкажіть дату й час");
      return;
    }
    const name = customerId
      ? allCustomers.find((c) => c.id === customerId)?.name ?? customerName
      : customerName.trim();
    if (!name) {
      toast.error("Вкажіть клієнта");
      return;
    }
    const priceNum = price.trim() === "" ? null : Number(price);
    if (priceNum != null && (Number.isNaN(priceNum) || priceNum < 0)) {
      toast.error("Некоректна ціна");
      return;
    }

    // Перевірка накладок: інтервали перетинаються, якщо start1 < end2 && start2 < end1.
    // Ігноруємо скасовані та сам запис при редагуванні.
    const newStart = start.getTime();
    const newEnd = newStart + durationMin * 60000;
    const clash = bookings.find((b) => {
      if (editing && b.id === editing.id) return false;
      if (b.status === "cancelled") return false;
      const s = tsToDate(b.start);
      if (!s) return false;
      const sMs = s.getTime();
      const eMs = sMs + b.durationMin * 60000;
      return newStart < eMs && sMs < newEnd;
    });
    if (clash) {
      const cs = tsToDate(clash.start);
      const ce = cs ? new Date(cs.getTime() + clash.durationMin * 60000) : null;
      const range = cs && ce ? ` (${hhmm(cs)}–${hhmm(ce)})` : "";
      const ok = confirm(
        `⚠️ Накладка з записом: ${clash.customerName}${range}.\nВсе одно зберегти?`
      );
      if (!ok) return;
    }

    const payload = {
      customerId,
      customerName: name,
      phone: phone.trim() || null,
      start: Timestamp.fromDate(start),
      durationMin,
      status,
      type: type.trim() || null,
      price: priceNum,
      paymentStatus,
      paymentMethod: paymentStatus === "paid" ? paymentMethod : null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await bookingsCrud.update(editing.id, payload);
        toast.success("Запис оновлено");
      } else {
        const newId = await bookingsCrud.create(payload);
        toast.success("Запис створено");
        // Fire-and-forget Telegram-нотифікація — не блокує UI.
        notifyNewBooking({
          bookingId: newId,
          customerName: name,
          phone: payload.phone,
          createdByName: currentAudit().name,
          whenText: formatDateTime(start),
          durationMin,
          type: payload.type,
          price: priceNum,
          status,
          paymentStatus: payload.paymentStatus,
          paymentMethod: payload.paymentMethod,
        }).catch((e) => console.warn("notifyNewBooking failed", e));
      }
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    const linkedOrderId = editing.orderId ?? null;
    const msg = linkedOrderId
      ? "Запис створено із замовлення. Видалити його з календаря? (замовлення залишиться)"
      : "Видалити запис?";
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      await bookingsCrud.remove(editing.id);
      // Розриваємо зворотній зв'язок у замовленні, щоб не лишався orphan-bookingId.
      if (linkedOrderId) {
        await clearOrderBookingLink(linkedOrderId).catch((e) =>
          console.warn("clearOrderBookingLink failed", e)
        );
      }
      toast.success("Запис видалено");
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалося видалити");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Редагувати запис" : "Новий запис на фотосесію"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Клієнт</Label>
            <EntityCombobox
              items={allCustomers.map((c) => ({
                id: c.id,
                label: c.name,
                hint: c.phone ?? undefined,
              }))}
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                if (id) {
                  const c = allCustomers.find((x) => x.id === id);
                  setCustomerName(c?.name ?? "");
                  if (c?.phone) setPhone(c.phone);
                } else {
                  setCustomerName("");
                }
              }}
              placeholder="Оберіть або створіть клієнта"
              onCreate={createCustomerInline}
            />
            <p className="text-xs text-muted-foreground">
              Існуючого — почніть вводити ім'я; нового — впишіть і натисніть
              «Створити».
            </p>
          </div>

          <div className="space-y-1">
            <Label>Телефон</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+380…"
              inputMode="tel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Дата й час</Label>
              <Input
                type="datetime-local"
                value={startStr}
                step={300}
                onChange={(e) => setStartStr(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Тривалість</Label>
              <Select
                value={String(durationMin)}
                onValueChange={(v) => setDurationMin(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {fmtDuration(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Тип зйомки</Label>
              <Input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Портрет, Сімейна…"
              />
            </div>
            <div className="space-y-1">
              <Label>Ціна, ₴</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1500"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Статус</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as BookingStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Оплата</Label>
              <Select
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Не оплачено</SelectItem>
                  <SelectItem value="paid">Оплачено</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentStatus === "paid" && (
              <div className="space-y-1">
                <Label>Спосіб</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Готівка</SelectItem>
                    <SelectItem value="card">Картка</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Нотатки</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Локація, побажання…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" /> Видалити
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {saving ? "Збереження…" : "Зберегти"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
