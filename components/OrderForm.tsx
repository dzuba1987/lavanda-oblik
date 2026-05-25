"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EntityCombobox, type ComboItem } from "@/components/EntityCombobox";
import { formatMoney, toInputDate, fromInputDate, tsToDate } from "@/lib/utils/format";
import type {
  Category,
  Customer,
  Order,
  OrderItem,
  Product,
} from "@/lib/data/types";
import {
  createOrder,
  updateOrder,
  type OrderInput,
} from "@/lib/data/orders";
import { categoriesCrud } from "@/lib/data/categories";
import { productsCrud } from "@/lib/data/products";
import { customersCrud } from "@/lib/data/customers";

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
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
    } else {
      setCustomerId(null);
      setItems([emptyItem()]);
      setDeadline("");
      setNotes("");
    }
    setLocalCategories([]);
    setLocalProducts([]);
    setLocalCustomers([]);
  }, [open, initial]);

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
      notes: null,
    });
    const fresh: Customer = {
      id,
      name: label,
      age: null,
      source: null,
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

    const input: OrderInput = {
      customerId,
      customerName: customer?.name ?? null,
      items: validatedItems,
      totalAmount: validatedItems.reduce((acc, it) => acc + it.totalAmount, 0),
      deadline: dl,
      status: initial?.status ?? "new",
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (initial) {
        await updateOrder(initial.id, input);
        toast.success("Замовлення оновлено");
      } else {
        await createOrder(input, uid);
        toast.success("Замовлення створено");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось зберегти");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Редагувати замовлення" : "Нове замовлення"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Клієнт (опц.)</Label>
            <EntityCombobox
              items={allCustomers.map((c) => ({
                id: c.id,
                label: c.name,
                hint: c.source ?? undefined,
              }))}
              value={customerId}
              onChange={(id) => setCustomerId(id)}
              placeholder="Не обрано"
              onCreate={createCustomerInline}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="order-deadline">Дедлайн (опц.)</Label>
            <Input
              id="order-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Позиції</Label>
              <span className="text-xs text-muted-foreground">
                Усього: <span className="font-semibold">{formatMoney(total)}</span>
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
                      inputMode="decimal"
                      step="0.01"
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

          <div className="space-y-1">
            <Label htmlFor="order-notes">Нотатки (опц.)</Label>
            <Textarea
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
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
