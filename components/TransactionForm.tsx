"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EntityCombobox, type ComboItem } from "@/components/EntityCombobox";
import { cn } from "@/lib/utils";
import {
  toInputDate,
  fromInputDate,
  tsToDate,
  formatMoney,
} from "@/lib/utils/format";
import type {
  Category,
  Customer,
  Product,
  Supplier,
  Transaction,
  TransactionType,
} from "@/lib/data/types";
import {
  createTransaction,
  updateTransaction,
  type TransactionInput,
} from "@/lib/data/transactions";
import { categoriesCrud } from "@/lib/data/categories";
import { productsCrud } from "@/lib/data/products";
import { suppliersCrud } from "@/lib/data/suppliers";
import { customersCrud } from "@/lib/data/customers";

export type TransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Transaction | null;
  uid: string;
  defaultType?: TransactionType;
  categories: Category[];
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  onSaved: () => void;
  onDictChanged?: () => void;
};

export function TransactionForm(props: TransactionFormProps) {
  const {
    open,
    onOpenChange,
    initial,
    uid,
    defaultType = "income",
    categories,
    products,
    suppliers,
    customers,
    onSaved,
    onDictChanged,
  } = props;

  const [type, setType] = useState<TransactionType>(defaultType);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [totalOverride, setTotalOverride] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Локальні «оптимістичні» довідники — щоб новостворені одразу з'являлись у combobox
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>([]);
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);

  const allCategories = useMemo(
    () => mergeById(categories, localCategories),
    [categories, localCategories]
  );
  const allProducts = useMemo(
    () => mergeById(products, localProducts),
    [products, localProducts]
  );
  const allSuppliers = useMemo(
    () => mergeById(suppliers, localSuppliers),
    [suppliers, localSuppliers]
  );
  const allCustomers = useMemo(
    () => mergeById(customers, localCustomers),
    [customers, localCustomers]
  );

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setType(initial.type);
      setDate(toInputDate(tsToDate(initial.date) ?? new Date()));
      setCategoryId(initial.categoryId ?? null);
      setProductId(initial.productId ?? null);
      setSupplierId(initial.supplierId ?? null);
      setCustomerId(initial.customerId ?? null);
      setUnitPrice(String(initial.unitPrice ?? ""));
      setQuantity(String(initial.quantity ?? 1));
      setTotalOverride(null);
      setNote(initial.note ?? "");
    } else {
      setType(defaultType);
      setDate(toInputDate(new Date()));
      setCategoryId(null);
      setProductId(null);
      setSupplierId(null);
      setCustomerId(null);
      setUnitPrice("");
      setQuantity("1");
      setTotalOverride(null);
      setNote("");
    }
    setLocalCategories([]);
    setLocalProducts([]);
    setLocalSuppliers([]);
    setLocalCustomers([]);
  }, [open, initial, defaultType]);

  const filteredCategories = allCategories.filter((c) => c.type === type);

  // Якщо змінили тип — скинути категорію, бо вона прив'язана до типу
  useEffect(() => {
    if (categoryId) {
      const cat = allCategories.find((c) => c.id === categoryId);
      if (cat && cat.type !== type) setCategoryId(null);
    }
  }, [type, categoryId, allCategories]);

  const computedTotal = useMemo(() => {
    const p = parseFloat(unitPrice);
    const q = parseFloat(quantity);
    if (Number.isNaN(p) || Number.isNaN(q)) return 0;
    return p * q;
  }, [unitPrice, quantity]);

  const totalValue = totalOverride != null ? parseFloat(totalOverride) : computedTotal;

  function handleSelectProduct(id: string | null, item: ComboItem | null) {
    setProductId(id);
    if (!id) return;
    const prod = allProducts.find((p) => p.id === id);
    if (prod) {
      if (!unitPrice && prod.defaultPrice != null) {
        setUnitPrice(String(prod.defaultPrice));
      }
      if (!categoryId && prod.defaultCategoryId) {
        const cat = allCategories.find((c) => c.id === prod.defaultCategoryId);
        if (cat && cat.type === type) setCategoryId(cat.id);
      }
    }
    void item;
  }

  async function createCategoryInline(label: string): Promise<ComboItem> {
    const id = await categoriesCrud.create({
      name: label,
      type,
      color: "#7c5cbb",
      sortOrder: 0,
    });
    const fresh: Category = {
      id,
      name: label,
      type,
      color: "#7c5cbb",
      sortOrder: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
    };
    setLocalCategories((p) => [fresh, ...p]);
    onDictChanged?.();
    return { id, label, swatch: "#7c5cbb" };
  }

  async function createProductInline(label: string): Promise<ComboItem> {
    const id = await productsCrud.create({
      name: label,
      unit: "шт",
      defaultPrice: null,
      defaultCategoryId: categoryId,
    });
    const fresh: Product = {
      id,
      name: label,
      unit: "шт",
      defaultPrice: null,
      defaultCategoryId: categoryId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
    };
    setLocalProducts((p) => [fresh, ...p]);
    onDictChanged?.();
    return { id, label };
  }

  async function createSupplierInline(label: string): Promise<ComboItem> {
    const id = await suppliersCrud.create({
      name: label,
      contact: null,
      notes: null,
    });
    const fresh: Supplier = {
      id,
      name: label,
      contact: null,
      notes: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date() as any,
    };
    setLocalSuppliers((p) => [fresh, ...p]);
    onDictChanged?.();
    return { id, label };
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

  async function handleSave() {
    if (!categoryId) {
      toast.error("Оберіть категорію");
      return;
    }
    const parsedDate = fromInputDate(date);
    if (!parsedDate) {
      toast.error("Невірна дата");
      return;
    }
    const p = parseFloat(unitPrice);
    const q = parseFloat(quantity);
    if (Number.isNaN(p) || p < 0) {
      toast.error("Невірна ціна");
      return;
    }
    if (Number.isNaN(q) || q <= 0) {
      toast.error("Невірна кількість");
      return;
    }

    const cat = allCategories.find((c) => c.id === categoryId);
    const prod = productId ? allProducts.find((x) => x.id === productId) : null;
    const sup = supplierId ? allSuppliers.find((x) => x.id === supplierId) : null;
    const cust = customerId ? allCustomers.find((x) => x.id === customerId) : null;

    const input: TransactionInput = {
      date: parsedDate,
      type,
      categoryId,
      categoryName: cat?.name ?? "",
      productId: productId,
      productName: prod?.name ?? null,
      supplierId: type === "expense" ? supplierId : null,
      supplierName: type === "expense" ? sup?.name ?? null : null,
      customerId: type === "income" ? customerId : null,
      customerName: type === "income" ? cust?.name ?? null : null,
      unitPrice: p,
      quantity: q,
      totalAmount: Number.isNaN(totalValue) ? p * q : totalValue,
      note: note.trim() || null,
    };

    setSaving(true);
    try {
      if (initial) {
        await updateTransaction(initial.id, input);
        toast.success("Збережено");
      } else {
        await createTransaction(input, uid);
        toast.success(
          type === "income" ? "Дохід додано" : "Витрату додано"
        );
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? "Редагувати запис"
              : type === "income"
                ? "Новий дохід"
                : "Нова витрата"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="income"
                className={cn(
                  "data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700",
                  "dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-200"
                )}
              >
                <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                Дохід
              </TabsTrigger>
              <TabsTrigger
                value="expense"
                className={cn(
                  "data-[state=active]:bg-red-100 data-[state=active]:text-red-700",
                  "dark:data-[state=active]:bg-red-950/40 dark:data-[state=active]:text-red-200"
                )}
              >
                <ArrowUpFromLine className="mr-1.5 h-4 w-4" />
                Витрата
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1">
            <Label htmlFor="t-date">Дата</Label>
            <Input
              id="t-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Категорія</Label>
            <EntityCombobox
              items={filteredCategories.map((c) => ({
                id: c.id,
                label: c.name,
                swatch: c.color,
              }))}
              value={categoryId}
              onChange={(id) => setCategoryId(id)}
              placeholder="Оберіть категорію"
              onCreate={createCategoryInline}
              clearable={false}
            />
          </div>

          <div className="space-y-1">
            <Label>Товар / послуга (опц.)</Label>
            <EntityCombobox
              items={allProducts.map((p) => ({
                id: p.id,
                label: p.name,
                hint: p.unit,
              }))}
              value={productId}
              onChange={(id, item) => handleSelectProduct(id, item)}
              placeholder="Не обрано"
              onCreate={createProductInline}
            />
          </div>

          {type === "expense" ? (
            <div className="space-y-1">
              <Label>Постачальник (опц.)</Label>
              <EntityCombobox
                items={allSuppliers.map((s) => ({
                  id: s.id,
                  label: s.name,
                }))}
                value={supplierId}
                onChange={(id) => setSupplierId(id)}
                placeholder="Не обрано"
                onCreate={createSupplierInline}
              />
            </div>
          ) : (
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="t-price">Ціна, грн</Label>
              <Input
                id="t-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => {
                  setUnitPrice(e.target.value);
                  setTotalOverride(null);
                }}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-qty">К-сть</Label>
              <Input
                id="t-qty"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setTotalOverride(null);
                }}
                placeholder="1"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-total">
              Сума
              <span className="ml-2 text-xs text-muted-foreground">
                (auto: {formatMoney(computedTotal)})
              </span>
            </Label>
            <Input
              id="t-total"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={totalOverride ?? (Number.isFinite(computedTotal) ? String(computedTotal) : "")}
              onChange={(e) => setTotalOverride(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-note">Нотатка (опц.)</Label>
            <Textarea
              id="t-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Будь-які деталі"
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
            className={cn(
              type === "income"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            )}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Зберегти" : "Додати"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) map.set(item.id, item);
  return Array.from(map.values());
}
