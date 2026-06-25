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
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Video,
  Camera,
  Star,
  CalendarDays,
  ListChecks,
  HelpCircle,
  Cloud,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  useDayWeather,
  weatherMeta,
  phasesFromWeather,
  useMonthWeather,
  monthDayEmoji,
  LIGHTING_META,
  DEFAULT_LOCATION,
  dayKey,
  fetchDayWeather,
  owmConfigured,
  useWeatherProvider,
  WEATHER_PROVIDER_META,
  type WeatherProvider,
  type DayWeather,
  type HourWeather,
  type LightingKey,
  type LightingPhase,
} from "@/lib/utils/weather";

// ── Конфіг ──────────────────────────────────────────────────────────────
// Старт о 05:00 — щоб вмістити ранкову blue/golden годину влітку.
const START_HOUR = 5;
const END_HOUR = 22;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);
const PX_PER_HOUR = 56;
// Ліва смуга під підписи фаз освітлення — записи зсунуті праворуч, щоб не перекривати.
const LABEL_LANE = 200;

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

/**
 * Статус для відображення: якщо сеанс уже завершився за часом (кінець у минулому),
 * показуємо «Завершено», окрім скасованих. БД не змінюємо — лише вигляд.
 */
function effectiveStatus(b: Booking): BookingStatus {
  if (b.status === "cancelled" || b.status === "done") return b.status;
  const d = tsToDate(b.start);
  if (!d) return b.status;
  const end = d.getTime() + b.durationMin * 60000;
  return end < Date.now() ? "done" : b.status;
}

/** Поточний час, оновлюється щохвилини (для лінії «зараз» на таймлайні). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Чи сеанс триває прямо зараз (початок ≤ now < кінець, не скасований). */
function isOngoing(b: Booking, now: Date): boolean {
  if (b.status === "cancelled") return false;
  const s = tsToDate(b.start);
  if (!s) return false;
  const end = s.getTime() + b.durationMin * 60000;
  return s.getTime() <= now.getTime() && now.getTime() < end;
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
  const [view, setView] = useState<CalView>("calendar");
  const [slotCat, setSlotCat] = useState<SlotCat>("photo");
  const [showWeather, setShowWeather] = useState(true);

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

  const { weather, loading: weatherLoading } = useDayWeather(day);
  const isMobile = useIsMobile();

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
          {/* Легенди — лише на десктопі (на мобільному економимо місце). */}
          <div className="hidden md:block">
            <div className="mt-3 space-y-1.5 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Статус записів
              </p>
              {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[s].dot)}
                  />
                  {STATUS_META[s].label}
                </div>
              ))}
            </div>
            <LightingLegend />
          </div>
          <WeatherCard day={day} weather={weather} loading={weatherLoading} />
        </Card>

        <Card className="p-0">
          <DayNav
            day={day}
            onChange={setDay}
            count={dayItems.length}
            view={view}
            onViewChange={setView}
            recommendedCount={recommendedSlots(weather).length}
            weatherOn={showWeather}
            onWeatherToggle={() => setShowWeather((v) => !v)}
            weatherToggle
          />
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : view === "calendar" ? (
            isMobile ? (
              <MobileTimeline
                items={dayItems.map((x) => x.b)}
                weather={weather}
                day={day}
                showWeather={showWeather}
                onNew={openNew}
                onEdit={openEdit}
                onSetPayment={setBookingPayment}
              />
            ) : (
              <>
                <BestHours weather={weather} />
                <Timeline
                  items={dayItems.map((x) => x.b)}
                  highlightId={highlightId}
                  weather={weather}
                  showWeather={showWeather}
                  day={day}
                  onSlotClick={(h) => {
                    const at = new Date(day);
                    at.setHours(h, 0, 0, 0);
                    openNew(at);
                  }}
                  onBookingClick={openEdit}
                  onSetPayment={setBookingPayment}
                />
              </>
            )
          ) : (
            <SlotsView
              weather={weather}
              cat={slotCat}
              onCatChange={setSlotCat}
              onBook={openNew}
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
type CalView = "calendar" | "slots";

function DayNav({
  day,
  onChange,
  count,
  view,
  onViewChange,
  recommendedCount,
  weatherOn,
  onWeatherToggle,
  weatherToggle,
}: {
  day: Date;
  onChange: (d: Date) => void;
  count: number;
  view: CalView;
  onViewChange: (v: CalView) => void;
  recommendedCount: number;
  weatherOn: boolean;
  onWeatherToggle: () => void;
  weatherToggle: boolean;
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
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
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
      <div className="flex items-center gap-2">
        {view === "calendar" && weatherToggle && (
          <Button
            variant="outline"
            size="icon"
            onClick={onWeatherToggle}
            aria-pressed={weatherOn}
            aria-label="Погодинна погода"
            title="Погодинна погода"
            className={cn(
              weatherOn && "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
            )}
          >
            <Cloud className="h-4 w-4" />
          </Button>
        )}
        <ViewToggle view={view} onChange={onViewChange} />
        {view === "slots" ? (
          <Badge className="gap-1 bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300">
            <Star className="h-3 w-3 fill-current" />
            рекомендовані слоти {recommendedCount}
          </Badge>
        ) : (
          <Badge variant="secondary">{count} записів</Badge>
        )}
      </div>
    </div>
  );
}

// Перемикач Календар / Слоти.
function ViewToggle({
  view,
  onChange,
}: {
  view: CalView;
  onChange: (v: CalView) => void;
}) {
  const opts: { key: CalView; label: string; Icon: typeof CalendarDays }[] = [
    { key: "calendar", label: "Календар", Icon: CalendarDays },
    { key: "slots", label: "Слоти", Icon: ListChecks },
  ];
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {opts.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={view === key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            view === key
              ? "bg-violet-600 text-white"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
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

// ── Мобільний таймлайн (колонка погоди + смуги фаз + картки-записи) ─────────
function hourOf(d: Date) {
  return d.getHours() + d.getMinutes() / 60;
}

const PXM = 60;
const M_GUTTER = 44;
const M_WCOL = 58;
// Ліва смуга під підпис фази — картки записів зсунуті праворуч, щоб не перекривати.
const M_LANE = 108;

function MobileTimeline({
  items,
  weather,
  day,
  showWeather,
  onNew,
  onEdit,
  onSetPayment,
}: {
  items: Booking[];
  weather: DayWeather | null;
  day: Date;
  showWeather: boolean;
  onNew: (at: Date) => void;
  onEdit: (b: Booking) => void;
  onSetPayment: (
    b: Booking,
    status: PaymentStatus,
    method: PaymentMethod | null
  ) => void;
}) {
  const phases = phasesFromWeather(weather);
  const byHour = new Map((weather?.hourly ?? []).map((h) => [h.hour, h]));
  const total = HOURS.length * PXM;
  const topPxM = (h: number) => (h - START_HOUR) * PXM;
  const now = useNow();
  const showNow =
    sameDay(now, day) &&
    hourOf(now) >= START_HOUR &&
    hourOf(now) <= END_HOUR + 1;

  const withStart = items
    .map((b) => ({ b, start: tsToDate(b.start) }))
    .filter((x): x is { b: Booking; start: Date } => x.start != null);

  const best = phases
    ? BEST_CARDS.map((c) => {
        const p = phases.find((x) => x.key === c.key);
        return p ? { ...c, p } : null;
      }).filter(Boolean)
    : [];

  return (
    <div>
      {/* Найкращі години — горизонтальний скрол */}
      {best.length > 0 && (
        <div className="border-b px-4 pb-3 pt-3">
          <p className="mb-2 text-sm font-medium">Найкращі години сьогодні</p>
          <div className="grid grid-cols-2 gap-2">
            {best.map((c) => {
              const m = LIGHTING_META[c!.key];
              const Icon = c!.Icon;
              return (
                <div
                  key={c!.key}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2",
                    m.band
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", m.text)} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tabular-nums">
                      {hhmm(c!.p.from)}–{hhmm(c!.p.to)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c!.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Таймлайн */}
      <div className="relative flex">
        {/* Години */}
        <div className="shrink-0 border-r" style={{ width: M_GUTTER }}>
          {HOURS.map((h) => (
            <div
              key={h}
              style={{ height: PXM }}
              className="relative pr-1 text-right text-[10px] tabular-nums text-muted-foreground"
            >
              <span className="absolute -top-1.5 right-1">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Колонка погоди */}
        {showWeather && (
          <div className="shrink-0 border-r" style={{ width: M_WCOL }}>
            {HOURS.map((h) => {
              const hw = byHour.get(h);
              if (!hw) return <div key={h} style={{ height: PXM }} />;
              const rain = hw.precipProb != null && hw.precipProb >= 40;
              return (
                <div
                  key={h}
                  style={{ height: PXM }}
                  className="flex items-center justify-center gap-1 leading-tight"
                >
                  <span className="text-base">{weatherMeta(hw.code).emoji}</span>
                  <div className="text-[10px]">
                    {hw.temp != null && (
                      <div className="font-medium tabular-nums">
                        {Math.round(hw.temp)}°
                      </div>
                    )}
                    <div
                      className={cn(
                        "tabular-nums",
                        rain ? "text-blue-500" : "text-muted-foreground"
                      )}
                    >
                      {rain ? `💧${hw.precipProb}%` : `☁${hw.cloud ?? "—"}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Смуги фаз + записи */}
        <div className="relative flex-1" style={{ height: total }}>
          {/* Фази: підпис у лівій смузі (M_LANE), завжди кольорові. */}
          {phases?.map((p) => {
            const top = clampPx(topPxM(hourOf(p.from)), total);
            const bottom = clampPx(topPxM(hourOf(p.to)), total);
            if (bottom <= top) return null;
            const m = LIGHTING_META[p.key];
            const Icon = PHASE_ICON[p.key];
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  const at = new Date(day);
                  const f = hourOf(p.from);
                  at.setHours(Math.floor(f), Math.round((f % 1) * 60), 0, 0);
                  onNew(at);
                }}
                style={{ top, height: bottom - top }}
                className={cn(
                  "absolute inset-x-0 overflow-hidden text-left",
                  m.band
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", m.swatch)} />
                <div
                  className="flex items-start gap-2 py-2 pl-3 pr-1"
                  style={{ width: M_LANE }}
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", m.text)} />
                  <span className="text-xs font-medium leading-tight">
                    {m.label}
                  </span>
                </div>
              </button>
            );
          })}

          {/* лінії годин */}
          {HOURS.map((h, i) => (
            <div
              key={h}
              style={{ top: i * PXM }}
              className="pointer-events-none absolute inset-x-0 border-b border-dashed border-border/40"
            />
          ))}

          {/* записи — кольорові за статусом, зсунуті праворуч від підписів фаз */}
          {withStart.map(({ b, start }) => {
            const end = new Date(start.getTime() + b.durationMin * 60000);
            const meta = STATUS_META[effectiveStatus(b)];
            const h = (b.durationMin / 60) * PXM;
            const ongoing = isOngoing(b, now) && sameDay(now, day);
            return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(b)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit(b);
                  }
                }}
                style={{
                  top: topPxM(hourOf(start)),
                  height: Math.max(h, 30),
                  left: M_LANE,
                }}
                className={cn(
                  "absolute right-1 z-10 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm",
                  meta.cls,
                  ongoing && "z-20 ring-2 ring-rose-500"
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate font-medium">{b.customerName}</span>
                  {ongoing && <OngoingBadge />}
                  <PaymentBadge b={b} onSetPayment={onSetPayment} />
                </div>
                <div className="flex items-center gap-1 opacity-80">
                  <Clock className="h-3 w-3" />
                  {hhmm(start)}–{hhmm(end)}
                  {b.type ? ` · ${b.type}` : ""}
                </div>
                {b.notes && (
                  <div className="truncate opacity-70">{b.notes}</div>
                )}
              </div>
            );
          })}

          {showNow && <NowLine top={topPxM(hourOf(now))} now={now} />}
        </div>
      </div>
    </div>
  );
}

// ── Рекомендовані слоти (вид «Слоти») ───────────────────────────────────────
type SlotCat = "photo" | "video" | "east" | "west";

const CAT_TABS: { key: SlotCat; label: string; Icon: typeof Sun }[] = [
  { key: "photo", label: "Фото", Icon: Camera },
  { key: "video", label: "Відео", Icon: Video },
  { key: "east", label: "Схід", Icon: Sunrise },
  { key: "west", label: "Захід", Icon: Sunset },
];

interface SlotRecipe {
  cats: SlotCat[];
  stars: number;
  badge: string;
  desc: string;
  why: string;
  Icon: typeof Sun;
}

// Які фази освітлення стають рекомендованими слотами (нейтрально/жорстке — ні).
const SLOT_RECIPES: Partial<Record<LightingKey, SlotRecipe>> = {
  idealAm: {
    cats: ["photo", "east"],
    stars: 5,
    badge: "Ідеально для фото",
    desc: "М'яке ранкове світло",
    why: "Оптимальний напрямок світла та м'які тіні створюють ідеальні умови для фото.",
    Icon: Sunrise,
  },
  goodAm: {
    cats: ["photo"],
    stars: 4,
    badge: "Добре для фото",
    desc: "Розсіяне денне світло",
    why: "Рівне світло без жорстких тіней — добре для портретів і груп.",
    Icon: Sun,
  },
  idealPm: {
    cats: ["photo", "west"],
    stars: 5,
    badge: "Ідеально для фото",
    desc: "Золота година, глибокі відтінки",
    why: "Низьке тепле сонце дає золотий відтінок і довгі м'які тіні.",
    Icon: Sunset,
  },
  bluePm: {
    cats: ["video", "west"],
    stars: 4,
    badge: "Ідеально для відео",
    desc: "Тепле сутінкове світло",
    why: "Рівне сутінкове світло — кінематографічна картинка для відео.",
    Icon: Video,
  },
};

interface RecSlot extends SlotRecipe {
  key: LightingKey;
  from: Date;
  to: Date;
}

function recommendedSlots(weather: DayWeather | null): RecSlot[] {
  const phases = phasesFromWeather(weather);
  if (!phases) return [];
  return phases
    .map((p) => {
      const r = SLOT_RECIPES[p.key];
      return r ? { key: p.key, from: p.from, to: p.to, ...r } : null;
    })
    .filter((s): s is RecSlot => s != null)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex shrink-0" aria-label={`${n} з 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < n
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}

function SlotsView({
  weather,
  cat,
  onCatChange,
  onBook,
}: {
  weather: DayWeather | null;
  cat: SlotCat;
  onCatChange: (c: SlotCat) => void;
  onBook: (at: Date) => void;
}) {
  const slots = recommendedSlots(weather);
  const filtered = slots.filter((s) => s.cats.includes(cat));

  return (
    <div className="p-4">
      {/* Фільтр-таби + підказка */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CAT_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onCatChange(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                cat === key
                  ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Як рахуються рекомендації"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-xs">
            Слоти рахуються за положенням сонця: схід/захід дають золоту годину,
            опівдні світло жорстке. Зірки — оцінка якості світла для обраного
            типу зйомки.
          </PopoverContent>
        </Popover>
      </div>

      {!weather?.sunrise ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Немає даних про сонце на цей день
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Немає рекомендованих слотів для «{CAT_TABS.find((t) => t.key === cat)?.label}»
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SlotCard key={s.key} slot={s} onBook={() => onBook(s.from)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({ slot, onBook }: { slot: RecSlot; onBook: () => void }) {
  const { Icon } = slot;
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <Icon className="h-5 w-5 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">
            {hhmm(slot.from)} – {hhmm(slot.to)}
          </span>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {slot.badge}
          </Badge>
        </div>
        <div className="truncate text-xs text-muted-foreground">{slot.desc}</div>
      </div>
      <Stars n={slot.stars} />
      <Button
        size="sm"
        onClick={onBook}
        className="shrink-0 bg-violet-600 hover:bg-violet-700"
      >
        Забронювати
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Чому цей слот рекомендовано?"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <p className="mb-1 text-sm font-medium">
            Чому цей слот рекомендовано?
          </p>
          <p className="text-xs text-muted-foreground">{slot.why}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Погодинна погода (компактна колонка на таймлайні) ───────────────────────
// emoji вже передає хмарність; окремих svg-іконок не дублюємо.
function HourlyWeatherCol({ hourly }: { hourly: HourWeather[] }) {
  const byHour = new Map(hourly.map((h) => [h.hour, h]));
  return (
    <div className="w-12 shrink-0 border-r">
      {HOURS.map((h) => {
        const hw = byHour.get(h);
        if (!hw) return <div key={h} style={{ height: PX_PER_HOUR }} />;
        const emoji = weatherMeta(hw.code).emoji;
        const rain = hw.precipProb != null && hw.precipProb >= 40;
        return (
          <div
            key={h}
            style={{ height: PX_PER_HOUR }}
            className="flex flex-col items-center justify-center leading-tight"
            title={`${hw.temp != null ? Math.round(hw.temp) + "°" : ""} · хмарність ${hw.cloud ?? "—"}% · опади ${hw.precipProb ?? 0}%`}
          >
            <span className="text-sm">{emoji}</span>
            {hw.temp != null && (
              <span className="text-[11px] font-medium tabular-nums">
                {Math.round(hw.temp)}°
              </span>
            )}
            <span
              className={cn(
                "text-[9px] tabular-nums",
                rain ? "text-blue-500" : "text-muted-foreground"
              )}
            >
              {rain
                ? `💧${hw.precipProb}%`
                : hw.cloud != null
                ? `☁${hw.cloud}%`
                : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Денний таймлайн ─────────────────────────────────────────────────────────
function Timeline({
  items,
  highlightId,
  weather,
  showWeather,
  day,
  onSlotClick,
  onBookingClick,
  onSetPayment,
}: {
  items: Booking[];
  highlightId: string | null;
  weather: DayWeather | null;
  showWeather: boolean;
  day: Date;
  onSlotClick: (hour: number) => void;
  onBookingClick: (b: Booking) => void;
  onSetPayment: (
    b: Booking,
    status: PaymentStatus,
    method: PaymentMethod | null
  ) => void;
}) {
  const isMobile = useIsMobile();
  const now = useNow();
  const showNow =
    sameDay(now, day) &&
    hourOf(now) >= START_HOUR &&
    hourOf(now) <= END_HOUR + 1;
  const totalH = HOURS.length * PX_PER_HOUR;
  const phases = phasesFromWeather(weather);
  // На мобільному підпис фази = лише іконка (текст ховаємо), записи майже на всю
  // ширину; на десктопі — повний підпис у лівій смузі.
  const lane = isMobile ? 30 : LABEL_LANE;
  const showLabelText = !isMobile;
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

      {showWeather && weather?.hourly?.length ? (
        <HourlyWeatherCol hourly={weather.hourly} />
      ) : null}

      <div className="relative flex-1" style={{ height: totalH }}>
        {/* Фази освітлення (під сіткою, не перехоплюють кліки). */}
        {phases?.map((p) => {
          const top = clampPx(topPx(p.from), totalH);
          const bottom = clampPx(topPx(p.to), totalH);
          if (bottom <= top) return null;
          const m = LIGHTING_META[p.key];
          const Icon = PHASE_ICON[p.key];
          return (
            <div
              key={p.key}
              style={{ top, height: bottom - top }}
              className={cn(
                "pointer-events-none absolute inset-x-0 flex gap-2.5 px-2 py-2 md:px-4",
                m.band
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", m.text)} />
              {showLabelText && (
                <div
                  className="leading-tight"
                  style={{ maxWidth: LABEL_LANE - 46 }}
                >
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {hhmm(p.from)} – {hhmm(p.to)}
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
          const meta = STATUS_META[effectiveStatus(b)];
          const h = (b.durationMin / 60) * PX_PER_HOUR;
          const isHi = b.id === highlightId;
          const ongoing = isOngoing(b, now) && sameDay(now, day);
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
              style={{ top: topPx(start), height: Math.max(h, 22), left: lane }}
              className={cn(
                "absolute right-2 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
                meta.cls,
                ongoing && "z-20 ring-2 ring-rose-500",
                isHi &&
                  "z-10 ring-2 ring-violet-500 ring-offset-2 ring-offset-background animate-pulse"
              )}
            >
              <div className="flex items-center gap-1">
                <span className="truncate font-medium">{b.customerName}</span>
                {ongoing && <OngoingBadge />}
                <PaymentBadge b={b} onSetPayment={onSetPayment} />
              </div>
              <div className="flex items-center gap-1 opacity-80">
                <Clock className="h-3 w-3" />
                {hhmm(start)}–{hhmm(end)}
                {b.type ? ` · ${b.type}` : ""}
              </div>
              {b.notes && (
                <div className="truncate opacity-70">{b.notes}</div>
              )}
            </div>
          );
        })}

        {showNow && <NowLine top={topPx(now)} now={now} />}
      </div>
    </div>
  );
}

/** Бейдж «йде зараз» — пульсуюча крапка + текст. */
function OngoingBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded bg-rose-500 px-1 py-0.5 text-[10px] font-medium leading-none text-white">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      йде
    </span>
  );
}

/** Червона лінія поточного часу + мітка години. */
function NowLine({ top, now }: { top: number; now: Date }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30"
      style={{ top }}
    >
      <div className="relative h-0.5 bg-rose-500">
        <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-rose-500" />
        <span className="absolute left-1 -top-2.5 rounded bg-rose-500 px-1 text-[10px] font-medium leading-tight text-white tabular-nums">
          {hhmm(now)}
        </span>
      </div>
    </div>
  );
}

// ── Освітлення дня ──────────────────────────────────────────────────────────
function clampPx(px: number, totalH: number) {
  return Math.max(0, Math.min(totalH, px));
}

// Іконка кожної фази освітлення.
const PHASE_ICON: Record<LightingKey, typeof Sun> = {
  idealAm: Sunrise,
  goodAm: Sunrise,
  neutral: Sun,
  harsh: Sunset,
  idealPm: Sunset,
  bluePm: Moon,
};

// Легенда світлових умов (бічна колонка) — усі фази по порядку дня.
const LEGEND_KEYS: LightingKey[] = [
  "idealAm",
  "goodAm",
  "neutral",
  "harsh",
  "idealPm",
  "bluePm",
];

function LightingLegend() {
  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Світлові умови
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {LEGEND_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "h-2.5 w-3 shrink-0 rounded-sm",
                LIGHTING_META[k].swatch
              )}
            />
            <span className="leading-tight">{LIGHTING_META[k].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Смужка «Найкращі години сьогодні» над таймлайном.
const BEST_CARDS: {
  key: LightingKey;
  title: string;
  Icon: typeof Sun;
}[] = [
  { key: "idealAm", title: "Східна сторона, фото", Icon: Sunrise },
  { key: "goodAm", title: "Добре для портретів", Icon: Sun },
  { key: "idealPm", title: "Західна сторона, фото", Icon: Sunset },
  { key: "bluePm", title: "Відео / blue hour", Icon: Moon },
];

function BestHours({ weather }: { weather: DayWeather | null }) {
  const phases = phasesFromWeather(weather);
  if (!phases) return null;
  const byKey = new Map<LightingKey, LightingPhase>(
    phases.map((p) => [p.key, p])
  );
  return (
    <div className="border-b px-4 py-3">
      <p className="mb-2 text-sm font-medium">Найкращі години сьогодні</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {BEST_CARDS.map(({ key, title, Icon }) => {
          const p = byKey.get(key);
          if (!p) return null;
          const m = LIGHTING_META[key];
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                m.band
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", m.text)} />
              <div className="min-w-0">
                <div className="text-sm font-semibold tabular-nums">
                  {hhmm(p.from)}–{hhmm(p.to)}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Картка погоди (бічна колонка, під легендою) ─────────────────────────────
function WeatherCard({
  day,
  weather,
  loading,
}: {
  day: Date;
  weather: DayWeather | null;
  loading: boolean;
}) {
  const meta = weatherMeta(weather?.code ?? null);
  const [provider, setProvider] = useWeatherProvider();
  const canCompare = owmConfigured();

  // Прогноз обох провайдерів для порівняння (кеш дедуплікує активний).
  const [both, setBoth] = useState<{
    "open-meteo": DayWeather | null;
    openweathermap: DayWeather | null;
  }>({ "open-meteo": null, openweathermap: null });
  useEffect(() => {
    if (!canCompare) return;
    let alive = true;
    Promise.all([
      fetchDayWeather(day, DEFAULT_LOCATION, "open-meteo"),
      fetchDayWeather(day, DEFAULT_LOCATION, "openweathermap"),
    ]).then(([om, owm]) => {
      if (alive) setBoth({ "open-meteo": om, openweathermap: owm });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey(day), canCompare]);

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Погода</p>
        <span className="text-[10px] text-muted-foreground">
          {DEFAULT_LOCATION.label}
        </span>
      </div>

      {canCompare && (
        <div className="flex rounded-md border p-0.5 text-[11px]">
          {(["open-meteo", "openweathermap"] as WeatherProvider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                "flex-1 rounded px-2 py-1 font-medium transition-colors",
                provider === p
                  ? "bg-violet-600 text-white"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {WEATHER_PROVIDER_META[p].label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : !weather ? (
        <p className="text-xs text-muted-foreground">Немає даних</p>
      ) : (
        <div className="space-y-2">
          {weather.hasWeather && (
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{meta.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{meta.label}</div>
                {weather.tempMax != null && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {fmtTemp(weather.tempMax)}
                    {weather.tempMin != null
                      ? ` … ${fmtTemp(weather.tempMin)}`
                      : ""}
                  </div>
                )}
              </div>
              {weather.precipProb != null && weather.precipProb > 0 && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  💧 {weather.precipProb}%
                </Badge>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <Sunrise className="h-3.5 w-3.5 text-amber-500" />
              <span className="tabular-nums">
                {weather.sunrise ? hhmm(weather.sunrise) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sunset className="h-3.5 w-3.5 text-orange-500" />
              <span className="tabular-nums">
                {weather.sunset ? hhmm(weather.sunset) : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {canCompare && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-[10px] font-medium text-muted-foreground">
            Порівняння прогнозу
          </p>
          {(["open-meteo", "openweathermap"] as WeatherProvider[]).map((p) => {
            const w = both[p];
            const m = weatherMeta(w?.code ?? null);
            return (
              <div
                key={p}
                className={cn(
                  "flex items-center gap-2 rounded px-1.5 py-0.5 text-xs",
                  provider === p && "bg-accent"
                )}
              >
                <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                  {WEATHER_PROVIDER_META[p].label}
                </span>
                {w?.hasWeather ? (
                  <>
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span className="tabular-nums">
                      {w.tempMax != null ? fmtTemp(w.tempMax) : "—"}
                    </span>
                    {w.precipProb != null && w.precipProb > 0 && (
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        💧 {w.precipProb}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">немає даних</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtTemp(t: number): string {
  const r = Math.round(t);
  return `${r > 0 ? "+" : ""}${r}°`;
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

  // Погода місяця (емодзі в кутику дня; у межах прогнозу).
  const monthWx = useMonthWeather(cursor.getFullYear(), cursor.getMonth());

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
          // Минулі дні з записами — позначаємо як завершені (зелена крапка).
          const past = d < todayD && !isToday;
          const wx = monthWx.get(d.getDate());
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
              {wx && (wx.code != null || wx.daylight != null) && (
                <span className="pointer-events-none absolute right-0.5 top-0.5 text-xs leading-none">
                  {monthDayEmoji(wx)}
                </span>
              )}
              {busy && !isSel && (
                <span
                  className={cn(
                    "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                    past ? "bg-emerald-500" : "bg-violet-500"
                  )}
                />
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

          <div className="space-y-1">
            <Label>Дата й час</Label>
            <Input
              type="datetime-local"
              value={startStr}
              step={300}
              onChange={(e) => setStartStr(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1">
              <Label>Тривалість</Label>
              <Select
                value={String(durationMin)}
                onValueChange={(v) => setDurationMin(Number(v))}
              >
                <SelectTrigger className="w-full">
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
            <div className="min-w-0 space-y-1">
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
            <Label>Тип зйомки</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Портрет, Сімейна…"
            />
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
                <SelectTrigger
                  className={
                    paymentStatus === "paid"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : undefined
                  }
                >
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
                  <SelectTrigger className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
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
