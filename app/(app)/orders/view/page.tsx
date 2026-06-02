"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Loader2,
  Navigation,
  Pencil,
  StickyNote,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { DELIVERY_LABELS, mapsDirectionsUrl, trackingUrl } from "@/lib/utils/delivery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { OrderComments } from "@/components/OrderComments";
import { useAuth } from "@/lib/auth/AuthContext";
import { getOrder } from "@/lib/data/orders";
import { cn } from "@/lib/utils";
import { formatDateLong, formatMoney, tsToDate } from "@/lib/utils/format";
import type { Delivery, Order, OrderStatus } from "@/lib/data/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Нове",
  confirmed: "Підтверджено",
  in_progress: "В роботі",
  assembled: "Готове до видачі",
  ready: "Готове",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
  confirmed: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  assembled: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
};

export default function OrderViewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </main>
      }
    >
      <OrderViewInner />
    </Suspense>
  );
}

function OrderViewInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { loading: authLoading, authUser } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) return;
    if (!id) return;

    setLoading(true);
    let cancelled = false;
    getOrder(id)
      .then((o) => {
        if (cancelled) return;
        if (!o) {
          setError("Замовлення не знайдено або у вас немає доступу");
        } else {
          setOrder(o);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const err = e as { message?: string };
        setError(err?.message ?? "Помилка завантаження");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, authUser, authLoading]);

  const renderedError = error ?? (!id ? "Не вказано ID замовлення" : null);

  if (authLoading || loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </main>
    );
  }

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            До списку
          </Link>
        </Button>
      </div>

      {renderedError || !order ? (
        <Card>
          <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
            {renderedError ?? "Замовлення недоступне"}
          </CardContent>
        </Card>
      ) : (
        <OrderDetails order={order} />
      )}
    </main>
  );
}

function OrderDetails({ order }: { order: Order }) {
  const deadlineDate = tsToDate(order.deadline);
  const createdDate = tsToDate(order.createdAt);
  const completedDate = tsToDate(order.deliveredAt);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn("font-normal", STATUS_COLOR[order.status])}
          >
            {STATUS_LABEL[order.status]}
          </Badge>
          {deadlineDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              до {formatDateLong(deadlineDate)}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {order.customerName ?? "Замовлення без клієнта"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {createdDate
            ? `Створено ${formatDateLong(createdDate)}`
            : "Створено —"}
          {completedDate && ` · Завершено ${formatDateLong(completedDate)}`}
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 px-4 py-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Позиції ({order.items.length})
          </h2>
          <ul className="divide-y">
            {order.items.map((it, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{it.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.categoryName} · {formatMoney(it.unitPrice)} ×{" "}
                    {it.quantity}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold">
                  {formatMoney(it.totalAmount)}
                </div>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Разом</span>
            <span className="text-lg font-semibold">
              {formatMoney(order.totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardContent className="space-y-2 px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4" />
              Нотатки
            </div>
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {order.delivery && (
        <DeliveryCard delivery={order.delivery} />
      )}

      {order.photos.length > 0 && (
        <Card>
          <CardContent className="space-y-2 px-4 py-4">
            <div className="text-sm text-muted-foreground">
              Фото ({order.photos.length})
            </div>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {order.photos.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxSrc(src)}
                  className="aspect-square overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80"
                  aria-label={`Збільшити фото ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Фото замовлення ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <OrderComments orderId={order.id} />

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

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/orders/?edit=${order.id}`}>
            <Pencil className="mr-1 h-4 w-4" />
            Редагувати
          </Link>
        </Button>
      </div>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <UserIcon className="h-3 w-3" /> Автор: {order.createdBy}
      </p>
    </>
  );
}

function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const url = trackingUrl(delivery.method, delivery.trackingNumber);
  return (
    <Card>
      <CardContent className="space-y-2 px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Truck className="h-4 w-4" />
          Доставка
        </div>
        <div className="text-sm font-medium">
          {DELIVERY_LABELS[delivery.method]}
        </div>
        {delivery.trackingNumber && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">ТТН:</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {delivery.trackingNumber}
            </span>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline dark:text-violet-400"
              >
                Відстежити
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
        {delivery.address && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Адреса: </span>
              {delivery.address}
            </div>
            {(() => {
              const mapUrl = mapsDirectionsUrl(delivery.address);
              if (!mapUrl) return null;
              return (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                >
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3.5 w-3.5 text-violet-600" />
                    Маршрут
                  </a>
                </Button>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
