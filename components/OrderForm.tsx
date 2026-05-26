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
import { formatMoney, toInputDate, fromInputDate, tsToDate } from "@/lib/utils/format";
import {
  ORDER_PHOTOS_MAX,
  DELIVERY_METHODS,
  type Category,
  type Customer,
  type DeliveryMethod,
  type DeliveryPaidBy,
  type Order,
  type OrderItem,
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
import { useAuth } from "@/lib/auth/AuthContext";

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
      newOrderIdRef.current = initial.id;
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
      newOrderIdRef.current = newOrderId();
    }
    setLocalCategories([]);
    setLocalProducts([]);
    setLocalCustomers([]);
  }, [open, initial, customers]);

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

      const delivery = deliveryMethod
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

      const input: OrderInput = {
        customerId,
        customerName: customer?.name ?? null,
        phone: phone.trim() || null,
        items: validatedItems,
        totalAmount: validatedItems.reduce(
          (acc, it) => acc + it.totalAmount,
          0
        ),
        deadline: dl,
        status: initial?.status ?? "new",
        notes: notes.trim() || null,
        photos,
        delivery,
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
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {initial ? "Редагувати замовлення" : "Нове замовлення"}
          </DialogTitle>
        </DialogHeader>

        <div className="thin-scrollbar -mx-6 flex-1 space-y-4 overflow-y-auto px-6 py-2">
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

          <div className="space-y-1">
            <Label htmlFor="order-deadline">Доставити до (опц.)</Label>
            <Input
              id="order-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
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
                    />
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
                    />
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

          <div className="space-y-2">
            <Label>Доставка (опц.)</Label>
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
                  <span className="text-[11px]">Додати</span>
                </button>
              )}
            </div>
          </div>

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
