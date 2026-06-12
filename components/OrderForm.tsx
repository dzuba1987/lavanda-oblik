"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Navigation, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderComments } from "@/components/OrderComments";
import { AuditInfo } from "@/components/AuditInfo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EntityCombobox, type ComboItem } from "@/components/EntityCombobox";
import { Timestamp } from "firebase/firestore";
import { formatMoney, toInputDate, fromInputDate, tsToDate } from "@/lib/utils/format";
import {
  ORDER_PHOTOS_MAX,
  DELIVERY_METHODS,
  type BookingStatus,
  type Category,
  type Customer,
  type DeliveryMethod,
  type DeliveryPaidBy,
  type Order,
  type OrderItem,
  type PaymentMethod,
  type PaymentStatus,
  type Product,
} from "@/lib/data/types";
import { DELIVERY_LABELS, hasTracking, mapsDirectionsUrl } from "@/lib/utils/delivery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOrder,
  newOrderId,
  updateOrder,
  type OrderInput,
} from "@/lib/data/orders";
import { imageToBase64Jpeg } from "@/lib/utils/image";
import { categoriesCrud } from "@/lib/data/categories";
import { productsCrud } from "@/lib/data/products";
import { customersCrud } from "@/lib/data/customers";
import { bookingsCrud } from "@/lib/data/bookings";
import { useAuth } from "@/lib/auth/AuthContext";

/** Тривалості фотосесії — дзеркалить форму календаря. */
const SESSION_DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240];

function fmtSessionDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h > 0 ? `${h} год` : "", m > 0 ? `${m} хв` : ""]
    .filter(Boolean)
    .join(" ");
}

/** Чи назва товару — фотосесія (за нею вмикаємо поля дати/часу замість доставки). */
function isPhotoSessionName(name: string | null | undefined): boolean {
  return /фотосес/i.test(name ?? "");
}

function toInputTime(d: Date | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * saved   — фото з документа (готовий data URL)
 * pending — щойно вибраний файл, ще не сконвертований в base64.
 *           previewUrl = blob: URL для попереднього перегляду.
 */
type PhotoSlot =
  | { kind: "saved"; dataUrl: string }
  | { kind: "pending"; id: string; file: File; previewUrl: string };

type ItemRow = {
  id: string;
  productId: string | null;
  productName: string;
  categoryId: string | null;
  categoryName: string;
  unitPrice: string;
  quantity: string;
};

export type OrderFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Order | null;
  uid: string;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  onSaved: () => void;
  onDictChanged?: () => void;
  /**
   * Draft з AI-парсингу голосового замовлення. Якщо переданий і немає
   * `initial` — попередньо заповнює форму. Транскрипт показується банером.
   */
  aiDraft?: import("@/lib/ai/types").ParsedOrder | null;
};

export function OrderForm({
  open,
  onOpenChange,
  initial,
  uid,
  categories,
  products,
  customers,
  onSaved,
  onDictChanged,
  aiDraft,
}: OrderFormProps) {
  const { authUser, userDoc } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  const newOrderIdRef = useRef<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // "" в селекті — без доставки
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [deliveryTracking, setDeliveryTracking] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [deliveryPaidBy, setDeliveryPaidBy] =
    useState<DeliveryPaidBy | "">("");

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  // Поля фотосесії (заміняють блок доставки, коли в позиціях є «Фотосесія»).
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);
  const [sessionType, setSessionType] = useState("");

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);

  const allCategories = useMemo(
    () => merge(categories, localCategories),
    [categories, localCategories]
  );
  const allProducts = useMemo(
    () => merge(products, localProducts),
    [products, localProducts]
  );
  const allCustomers = useMemo(
    () => merge(customers, localCustomers),
    [customers, localCustomers]
  );

  // Категорії для замовлення — тільки income (бо замовлення → дохід)
  const incomeCategories = allCategories.filter((c) => c.type === "income");

  // Чи є серед позицій фотосесія → показуємо поля дати/часу замість доставки.
  const isPhotoSession = useMemo(
    () =>
      items.some((row) => {
        const name = row.productId
          ? allProducts.find((p) => p.id === row.productId)?.name
          : row.productName;
        return isPhotoSessionName(name);
      }),
    [items, allProducts]
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCustomerId(initial.customerId);
      const initialCustomer = initial.customerId
        ? customers.find((c) => c.id === initial.customerId)
        : null;
      setPhone(initial.phone ?? initialCustomer?.phone ?? "");
      setItems(
        initial.items.map((it, i) => ({
          id: `init-${i}`,
          productId: it.productId,
          productName: it.productName,
          categoryId: it.categoryId,
          categoryName: it.categoryName,
          unitPrice: String(it.unitPrice),
          quantity: String(it.quantity),
        }))
      );
      setDeadline(toInputDate(tsToDate(initial.deadline)));
      setNotes(initial.notes ?? "");
      setPhotoSlots(
        (initial.photos ?? []).map((dataUrl) => ({ kind: "saved", dataUrl }))
      );
      setDeliveryMethod(initial.delivery?.method ?? "");
      setDeliveryTracking(initial.delivery?.trackingNumber ?? "");
      setDeliveryAddress(initial.delivery?.address ?? "");
      setDeliveryCost(
        initial.delivery?.cost != null ? String(initial.delivery.cost) : ""
      );
      setDeliveryPaidBy(initial.delivery?.paidBy ?? "");
      setPaymentStatus(initial.paymentStatus ?? "unpaid");
      setPaymentMethod(initial.paymentMethod ?? "cash");
      const ps = initial.photoSession;
      const psStart = ps ? tsToDate(ps.start) : null;
      setSessionDate(psStart ? toInputDate(psStart) : "");
      setSessionTime(toInputTime(psStart));
      setSessionDuration(ps?.durationMin ?? 60);
      setSessionType(ps?.type ?? "");
      newOrderIdRef.current = initial.id;
    } else if (aiDraft) {
      // Префіл з AI-парсингу голосового замовлення. Беремо найкращий
      // customer-кандидат якщо score < 0.3 (high-confidence), інакше null —
      // user обере зі списку candidates у UI.
      const bestCandidate = aiDraft.customerCandidates[0];
      const autoMatchCustomer =
        bestCandidate && bestCandidate.score < 0.3 ? bestCandidate : null;
      setCustomerId(autoMatchCustomer?.id ?? null);
      setPhone("");
      setItems(
        aiDraft.items.length > 0
          ? aiDraft.items.map((it, i) => ({
              id: `ai-${i}`,
              productId: it.productId,
              productName: it.productName,
              categoryId: it.categoryId,
              categoryName: it.categoryName,
              unitPrice: String(it.unitPrice),
              quantity: String(it.quantity),
            }))
          : [emptyItem()]
      );
      setDeadline("");
      setNotes(aiDraft.notes ?? "");
      setPhotoSlots([]);
      setDeliveryMethod(aiDraft.delivery?.method ?? "");
      setDeliveryTracking(aiDraft.delivery?.trackingNumber ?? "");
      setDeliveryAddress(aiDraft.delivery?.address ?? "");
      setDeliveryCost(
        aiDraft.delivery?.cost != null ? String(aiDraft.delivery.cost) : ""
      );
      setDeliveryPaidBy(aiDraft.delivery?.paidBy ?? "");
      setPaymentStatus("unpaid");
      setPaymentMethod("cash");
      setSessionDate("");
      setSessionTime("");
      setSessionDuration(60);
      setSessionType("");
      newOrderIdRef.current = newOrderId();
    } else {
      setCustomerId(null);
      setPhone("");
      setItems([emptyItem()]);
      setDeadline("");
      setNotes("");
      setPhotoSlots([]);
      setDeliveryMethod("");
      setDeliveryTracking("");
      setDeliveryAddress("");
      setDeliveryCost("");
      setDeliveryPaidBy("");
      setPaymentStatus("unpaid");
      setPaymentMethod("cash");
      setSessionDate("");
      setSessionTime("");
      setSessionDuration(60);
      setSessionType("");
      newOrderIdRef.current = newOrderId();
    }
    setLocalCategories([]);
    setLocalProducts([]);
    setLocalCustomers([]);
    // customers / categories / products навмисно не в deps: інакше після
    // onDictChanged (наприклад, після inline-створення клієнта) ефект
    // re-fired би і скидав customerId/локальний кеш.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, aiDraft]);

  // М'який backfill телефону: якщо форму відкрито без збереженого phone, але
  // у клієнта є phone у словнику customers — підставити. Спрацьовує, коли
  // customers догружаються після відкриття форми. Не перезаписує phone,
  // якщо user його вже вписав вручну.
  useEffect(() => {
    if (!open || phone) return;
    if (!customerId) return;
    const c = allCustomers.find((x) => x.id === customerId);
    if (c?.phone) setPhone(c.phone);
  }, [open, customerId, allCustomers, phone]);

  // Аналогічно для адреси доставки: підставляємо customer.address якщо
  // користувач ще не ввів свою адресу для цього замовлення.
  useEffect(() => {
    if (!open || deliveryAddress) return;
    if (!customerId) return;
    const c = allCustomers.find((x) => x.id === customerId);
    if (c?.address) setDeliveryAddress(c.address);
  }, [open, customerId, allCustomers, deliveryAddress]);

  // Cleanup object URLs on unmount/close
  useEffect(() => {
    if (open) return;
    photoSlots.forEach((s) => {
      if (s.kind === "pending") URL.revokeObjectURL(s.previewUrl);
    });
  }, [open, photoSlots]);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const free = ORDER_PHOTOS_MAX - photoSlots.length;
    const taken = files.slice(0, free);
    if (files.length > free) {
      toast.warning(
        `Можна додати максимум ${ORDER_PHOTOS_MAX} фото на замовлення`
      );
    }
    const next: PhotoSlot[] = taken.map((file) => ({
      kind: "pending",
      id: Math.random().toString(36).slice(2),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotoSlots((prev) => [...prev, ...next]);
  }

  function removePhotoSlot(slot: PhotoSlot) {
    if (slot.kind === "saved") {
      setPhotoSlots((prev) =>
        prev.filter(
          (s) => !(s.kind === "saved" && s.dataUrl === slot.dataUrl)
        )
      );
    } else {
      URL.revokeObjectURL(slot.previewUrl);
      setPhotoSlots((prev) =>
        prev.filter((s) => !(s.kind === "pending" && s.id === slot.id))
      );
    }
  }

  const total = useMemo(() => {
    return items.reduce((acc, it) => {
      const p = parseFloat(it.unitPrice);
      const q = parseFloat(it.quantity);
      if (Number.isNaN(p) || Number.isNaN(q)) return acc;
      return acc + p * q;
    }, 0);
  }, [items]);

  function patchItem(id: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((it) => it.id !== id)
    );
  }

  async function createCustomerInline(label: string): Promise<ComboItem> {
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
    onDictChanged?.();
    return { id, label };
  }

  async function createCategoryInline(label: string): Promise<ComboItem> {
    const id = await categoriesCrud.create({
      name: label,
      type: "income",
      color: "#7c5cbb",
      sortOrder: 0,
    });
    const fresh: Category = {
      id,
      name: label,
      type: "income",
      color: "#7c5cbb",
      sortOrder: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
    };
    setLocalCategories((p) => [fresh, ...p]);
    onDictChanged?.();
    return { id, label, swatch: "#7c5cbb" };
  }

  async function createProductInline(
    label: string,
    row: ItemRow
  ): Promise<ComboItem> {
    const id = await productsCrud.create({
      name: label,
      unit: "шт",
      defaultPrice: null,
      defaultCategoryId: row.categoryId,
    });
    const fresh: Product = {
      id,
      name: label,
      unit: "шт",
      defaultPrice: null,
      defaultCategoryId: row.categoryId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
    };
    setLocalProducts((p) => [fresh, ...p]);
    onDictChanged?.();
    return { id, label };
  }

  function handleSelectProduct(row: ItemRow, id: string | null) {
    const patch: Partial<ItemRow> = { productId: id };
    if (id) {
      const prod = allProducts.find((p) => p.id === id);
      if (prod) {
        patch.productName = prod.name;
        if (!row.unitPrice && prod.defaultPrice != null) {
          patch.unitPrice = String(prod.defaultPrice);
        }
        if (!row.categoryId && prod.defaultCategoryId) {
          const cat = allCategories.find((c) => c.id === prod.defaultCategoryId);
          if (cat && cat.type === "income") {
            patch.categoryId = cat.id;
            patch.categoryName = cat.name;
          }
        }
      }
    } else {
      patch.productName = "";
    }
    patchItem(row.id, patch);
  }

  function handleSelectCategory(row: ItemRow, id: string | null) {
    const cat = id ? allCategories.find((c) => c.id === id) : null;
    patchItem(row.id, {
      categoryId: id,
      categoryName: cat?.name ?? "",
    });
  }

  async function handleSave() {
    const customer = customerId
      ? allCustomers.find((c) => c.id === customerId)
      : null;

    // Валідація позицій
    const validatedItems: OrderItem[] = [];
    for (const row of items) {
      if (!row.productId && !row.productName.trim()) {
        toast.error("Усі позиції мають містити товар");
        return;
      }
      if (!row.categoryId) {
        toast.error("Усі позиції мають містити категорію");
        return;
      }
      const p = parseFloat(row.unitPrice);
      const q = parseFloat(row.quantity);
      if (Number.isNaN(p) || p < 0) {
        toast.error("Невірна ціна в одній з позицій");
        return;
      }
      if (Number.isNaN(q) || q <= 0) {
        toast.error("Невірна кількість в одній з позицій");
        return;
      }

      const prod = row.productId
        ? allProducts.find((x) => x.id === row.productId)
        : null;
      const cat = allCategories.find((c) => c.id === row.categoryId);

      validatedItems.push({
        productId: row.productId,
        productName: prod?.name ?? row.productName.trim(),
        categoryId: row.categoryId,
        categoryName: cat?.name ?? row.categoryName,
        unitPrice: p,
        quantity: q,
        totalAmount: p * q,
      });
    }

    if (validatedItems.length === 0) {
      toast.error("Додайте принаймні одну позицію");
      return;
    }

    const dl = deadline ? fromInputDate(deadline) : null;
    const orderId = newOrderIdRef.current;

    setSaving(true);
    try {
      const photos: string[] = [];
      for (const slot of photoSlots) {
        if (slot.kind === "saved") {
          photos.push(slot.dataUrl);
        } else {
          photos.push(await imageToBase64Jpeg(slot.file));
        }
      }

      const parsedCost = deliveryCost.trim() === "" ? null : Number(deliveryCost);
      if (parsedCost != null && (Number.isNaN(parsedCost) || parsedCost < 0)) {
        toast.error("Невірна вартість доставки");
        setSaving(false);
        return;
      }

      // Фотосесія заміняє доставку — обнуляємо delivery, навіть якщо в стейті
      // лишилось значення з попереднього вибору.
      const delivery = !isPhotoSession && deliveryMethod
        ? {
            method: deliveryMethod,
            trackingNumber: hasTracking(deliveryMethod)
              ? deliveryTracking.trim() || null
              : null,
            address: deliveryAddress.trim() || null,
            cost: parsedCost && parsedCost > 0 ? parsedCost : null,
            paidBy:
              parsedCost && parsedCost > 0 && deliveryPaidBy
                ? deliveryPaidBy
                : null,
          }
        : null;

      const totalAmount = validatedItems.reduce(
        (acc, it) => acc + it.totalAmount,
        0
      );
      const orderStatus = initial?.status ?? "new";

      // ── Фотосесія: дата+час обов'язкові, синхронізуємо запис у календарі ──
      let sessionStart: Date | null = null;
      let linkedBookingId: string | null = initial?.bookingId ?? null;
      if (isPhotoSession) {
        if (!sessionDate || !sessionTime) {
          toast.error("Вкажіть дату й час фотосесії");
          setSaving(false);
          return;
        }
        sessionStart = new Date(`${sessionDate}T${sessionTime}`);
        if (Number.isNaN(sessionStart.getTime())) {
          toast.error("Невірні дата/час фотосесії");
          setSaving(false);
          return;
        }
        // ready — термінальний статус замовлення → фотосесія «завершена».
        const bStatus: BookingStatus =
          orderStatus === "ready" ? "done" : "confirmed";
        const bookingPayload = {
          customerId,
          customerName: customer?.name?.trim() || "Фотосесія",
          phone: phone.trim() || null,
          start: Timestamp.fromDate(sessionStart),
          durationMin: sessionDuration,
          status: bStatus,
          type: sessionType.trim() || null,
          price: totalAmount,
          paymentStatus,
          paymentMethod: paymentStatus === "paid" ? paymentMethod : null,
          notes: notes.trim() || null,
          orderId,
        };
        try {
          if (linkedBookingId) {
            await bookingsCrud.update(linkedBookingId, bookingPayload);
          } else {
            linkedBookingId = await bookingsCrud.create(bookingPayload);
          }
        } catch (e) {
          console.error("booking sync failed", e);
          toast.error("Не вдалось синхронізувати запис у календарі");
          setSaving(false);
          return;
        }
      } else if (linkedBookingId) {
        // Фотосесію прибрали з позицій → видаляємо пов'язаний запис.
        try {
          await bookingsCrud.remove(linkedBookingId);
        } catch (e) {
          console.warn("booking cleanup failed", e);
        }
        linkedBookingId = null;
      }

      const input: OrderInput = {
        customerId,
        customerName: customer?.name ?? null,
        phone: phone.trim() || null,
        items: validatedItems,
        totalAmount,
        deadline: dl,
        status: orderStatus,
        notes: notes.trim() || null,
        photos,
        delivery,
        paymentStatus,
        paymentMethod: paymentStatus === "paid" ? paymentMethod : null,
        photoSession:
          isPhotoSession && sessionStart
            ? {
                start: sessionStart,
                durationMin: sessionDuration,
                type: sessionType.trim() || null,
              }
            : null,
        bookingId: linkedBookingId,
      };

      if (initial) {
        await updateOrder(initial.id, input);
        toast.success("Замовлення оновлено");
      } else {
        const createdByName =
          userDoc?.name || authUser?.displayName || authUser?.email || null;
        await createOrder(orderId, input, uid, createdByName);
        toast.success("Замовлення створено");
      }

      // Backfill — якщо у клієнта ще не було phone/address, а у замовленні
      // тепер є — пропишемо їх назад у клієнта, щоб наступного разу
      // підставлялись автоматично.
      if (customerId) {
        const existing = allCustomers.find((c) => c.id === customerId);
        if (existing) {
          const patch: Record<string, string | null> = {};
          const orderPhone = phone.trim();
          if (orderPhone && !existing.phone) patch.phone = orderPhone;
          const orderAddress = (delivery?.address ?? "").trim();
          if (orderAddress && !existing.address) patch.address = orderAddress;
          if (Object.keys(patch).length > 0) {
            try {
              await customersCrud.update(customerId, patch);
              onDictChanged?.();
            } catch (e) {
              console.warn("customer backfill failed", e);
            }
          }
        }
      }

      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      const err = e as { code?: string; message?: string };
      if (err?.code === "resource-exhausted" || err?.message?.includes("exceeds")) {
        toast.error(
          "Фото занадто великі. Спробуйте видалити частину або вибрати інші."
        );
      } else {
        toast.error("Не вдалось зберегти");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {initial ? "Редагувати замовлення" : "Нове замовлення"}
          </DialogTitle>
        </DialogHeader>

        <div className="thin-scrollbar -mx-6 flex-1 space-y-4 overflow-y-auto px-6 py-2">
          {aiDraft && !initial && (
            <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-xs dark:border-violet-900/40 dark:bg-violet-950/30">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
                🎙 Голосовий ввід
              </div>
              <div className="italic text-violet-900/80 dark:text-violet-200/80">
                «{aiDraft.transcript}»
              </div>
              {aiDraft.customerCandidates.length > 0 && !customerId && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-violet-700 dark:text-violet-300">
                    Клієнт «{aiDraft.customerName}»:
                  </span>
                  {aiDraft.customerCandidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        const cust = allCustomers.find((x) => x.id === c.id);
                        if (cust?.phone) setPhone(cust.phone);
                      }}
                      className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-100 dark:bg-violet-900/50 dark:text-violet-200 dark:ring-violet-800"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Клієнт (опц.)</Label>
              <EntityCombobox
                items={allCustomers.map((c) => ({
                  id: c.id,
                  label: c.name,
                  hint: c.source ?? undefined,
                }))}
                value={customerId}
                onChange={(id) => {
                  setCustomerId(id);
                  if (id) {
                    const c = allCustomers.find((x) => x.id === id);
                    if (c?.phone) setPhone(c.phone);
                  }
                }}
                placeholder="Не обрано"
                onCreate={createCustomerInline}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="order-phone">Телефон (опц.)</Label>
              <Input
                id="order-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380 67 123 45 67"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Оплата</Label>
            <div className="flex gap-2">
              <Select
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Не оплачено</SelectItem>
                  <SelectItem value="paid">Оплачено</SelectItem>
                </SelectContent>
              </Select>
              {paymentStatus === "paid" && (
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Готівка</SelectItem>
                    <SelectItem value="card">Картка</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Позиції</Label>
              <span className="inline-flex items-baseline gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-sm text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                <span className="text-xs opacity-80">Усього:</span>
                <span className="text-base font-bold tabular-nums">{formatMoney(total)}</span>
              </span>
            </div>
            <div className="space-y-3">
              {items.map((row, idx) => (
                <div
                  key={row.id}
                  className="space-y-2 rounded-md border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Позиція {idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeItem(row.id)}
                      disabled={items.length === 1}
                      aria-label="Видалити позицію"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <EntityCombobox
                    items={allProducts.map((p) => ({
                      id: p.id,
                      label: p.name,
                      hint: p.unit,
                    }))}
                    value={row.productId}
                    onChange={(id) => handleSelectProduct(row, id)}
                    placeholder="Оберіть товар"
                    onCreate={(label) => createProductInline(label, row)}
                  />

                  <EntityCombobox
                    items={incomeCategories.map((c) => ({
                      id: c.id,
                      label: c.name,
                      swatch: c.color,
                    }))}
                    value={row.categoryId}
                    onChange={(id) => handleSelectCategory(row, id)}
                    placeholder="Категорія"
                    onCreate={createCategoryInline}
                    clearable={false}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={row.unitPrice}
                        onChange={(e) =>
                          patchItem(row.id, { unitPrice: e.target.value })
                        }
                        placeholder="Ціна"
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                        грн
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          patchItem(row.id, { quantity: e.target.value })
                        }
                        placeholder="К-сть"
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                        шт
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={addItem}
              >
                <Plus className="mr-1 h-4 w-4" /> Додати позицію
              </Button>
            </div>
          </div>

          {!isPhotoSession && (
          <div className="space-y-2 rounded-md border bg-card p-3">
            <Label>Доставка (опц.)</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label
                  htmlFor="order-deadline"
                  className="text-xs text-muted-foreground"
                >
                  Доставити до
                </Label>
                <Input
                  id="order-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Спосіб</Label>
                <Select
                  value={deliveryMethod || "none"}
                  onValueChange={(v) =>
                    setDeliveryMethod(v === "none" ? "" : (v as DeliveryMethod))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не вказано</SelectItem>
                    {DELIVERY_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {DELIVERY_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {deliveryMethod && hasTracking(deliveryMethod) && (
              <Input
                value={deliveryTracking}
                onChange={(e) => setDeliveryTracking(e.target.value)}
                placeholder="ТТН / номер відправлення"
                inputMode="numeric"
              />
            )}
            {deliveryMethod && (
              <>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={
                    deliveryMethod === "self_pickup"
                      ? "Місце або деталі"
                      : "Адреса або № відділення"
                  }
                />
                {deliveryAddress.trim() && deliveryMethod !== "self_pickup" && (() => {
                  const mapUrl = mapsDirectionsUrl(deliveryAddress);
                  if (!mapUrl) return null;
                  return (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline dark:text-violet-400"
                    >
                      <Navigation className="h-3 w-3" />
                      Відкрити маршрут у картах
                    </a>
                  );
                })()}

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="del-cost" className="text-xs text-muted-foreground">
                      Вартість доставки (опц.)
                    </Label>
                    <Input
                      id="del-cost"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={deliveryCost}
                      onChange={(e) => setDeliveryCost(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  {deliveryCost.trim() !== "" && Number(deliveryCost) > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Платить</Label>
                      <Select
                        value={deliveryPaidBy || ""}
                        onValueChange={(v) =>
                          setDeliveryPaidBy(v as DeliveryPaidBy | "")
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Клієнт (дохід)</SelectItem>
                          <SelectItem value="us">Ми (витрата)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}

          {isPhotoSession && (
            <div className="space-y-2 rounded-md border bg-card p-3">
              <Label>Фотосесія</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label
                    htmlFor="session-date"
                    className="text-xs text-muted-foreground"
                  >
                    Дата
                  </Label>
                  <Input
                    id="session-date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="session-time"
                    className="text-xs text-muted-foreground"
                  >
                    Час
                  </Label>
                  <Input
                    id="session-time"
                    type="time"
                    step={300}
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Тривалість
                  </Label>
                  <Select
                    value={String(sessionDuration)}
                    onValueChange={(v) => setSessionDuration(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_DURATIONS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {fmtSessionDuration(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="session-type"
                    className="text-xs text-muted-foreground"
                  >
                    Тип зйомки
                  </Label>
                  <Input
                    id="session-type"
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value)}
                    placeholder="Портрет, Сімейна…"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Запис автоматично з'явиться в календарі «Фотосесії».
              </p>
            </div>
          )}

          {!isPhotoSession && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Фото (опц.)</Label>
              <span className="text-xs text-muted-foreground">
                {photoSlots.length}/{ORDER_PHOTOS_MAX}
              </span>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={handlePhotoPick}
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photoSlots.map((slot, idx) => {
                const src =
                  slot.kind === "saved" ? slot.dataUrl : slot.previewUrl;
                const key =
                  slot.kind === "saved" ? `s-${idx}` : `p-${slot.id}`;
                return (
                  <div
                    key={key}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(src)}
                      className="block h-full w-full"
                      aria-label={`Збільшити фото ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Фото ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    {slot.kind === "pending" && (
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Нове
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhotoSlot(slot)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      aria-label="Видалити фото"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {photoSlots.length < ORDER_PHOTOS_MAX && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-violet-500 hover:text-violet-600"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-xs">Додати</span>
                </button>
              )}
            </div>
          </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="order-notes">Нотатки (опц.)</Label>
            <Textarea
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {initial && <OrderComments orderId={initial.id} />}

          <AuditInfo item={initial} />
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Скасувати
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Зберегти" : "Створити"}
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
        className="max-h-[95dvh] max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl"
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
    </>
  );
}

function emptyItem(): ItemRow {
  return {
    id: Math.random().toString(36).slice(2),
    productId: null,
    productName: "",
    categoryId: null,
    categoryName: "",
    unitPrice: "",
    quantity: "1",
  };
}

function merge<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const it of a) map.set(it.id, it);
  for (const it of b) map.set(it.id, it);
  return Array.from(map.values());
}
