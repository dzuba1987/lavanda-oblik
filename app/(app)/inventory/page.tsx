"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { CrudPage, type CrudColumn } from "@/components/CrudPage";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/EntityCombobox";
import { productsCrud, COMMON_UNITS } from "@/lib/data/products";
import { categoriesCrud } from "@/lib/data/categories";
import { AuditInfo } from "@/components/AuditInfo";
import { imageToBase64Jpeg } from "@/lib/utils/image";
import { cn } from "@/lib/utils";
import type { Category, Product } from "@/lib/data/types";

type Row = Product;

const NONE_VALUE = "__none";

export default function InventoryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Лише категорії, що реально є в товарах — щоб не пропонувати порожні фільтри.
  const usedCategories = useMemo(() => {
    const ids = new Set(
      items.map((it) => it.defaultCategoryId).filter(Boolean) as string[]
    );
    return categories.filter((c) => ids.has(c.id));
  }, [items, categories]);

  // Товари після фільтра за категорією (пошук далі робить сам CrudPage).
  const visibleItems = useMemo(
    () =>
      categoryFilter
        ? items.filter((it) => it.defaultCategoryId === categoryFilter)
        : items,
    [items, categoryFilter]
  );

  async function reload() {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        productsCrud.list(),
        categoriesCrud.list(),
      ]);
      setItems(prods as Row[]);
      setCategories(cats as Category[]);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити дані");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(row: Row) {
    try {
      await productsCrud.remove(row.id);
      toast.success("Товар видалено");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось видалити");
    }
  }

  // Підсумки рахуємо з видимих товарів — щоб відповідали обраному фільтру.
  const stockValue = useMemo(
    () =>
      visibleItems.reduce(
        (sum, it) => sum + (it.stock ?? 0) * (it.costPrice ?? 0),
        0
      ),
    [visibleItems]
  );
  const totalUnits = useMemo(
    () => visibleItems.reduce((sum, it) => sum + (it.stock ?? 0), 0),
    [visibleItems]
  );

  const columns: CrudColumn<Row>[] = [
    {
      key: "name",
      label: "Назва",
      render: (it) => {
        const cat = it.defaultCategoryId
          ? catById.get(it.defaultCategoryId)
          : null;
        return (
          <div className="flex items-center gap-3">
            {it.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.photo}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ImagePlus className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 font-medium">
                {cat && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                    title={cat.name}
                  />
                )}
                <span className="truncate">{it.name}</span>
              </div>
              <div className="text-xs text-muted-foreground md:hidden">
                <StockText stock={it.stock} unit={it.unit} />
                {it.costPrice != null &&
                  ` · закуп. ${formatPrice(it.costPrice)}`}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "stock",
      label: "Залишок",
      className: "w-28",
      render: (it) => <StockBadge stock={it.stock} unit={it.unit} />,
    },
    {
      key: "costPrice",
      label: "Закупівля",
      className: "w-28 text-right",
      hideOnMobile: true,
      render: (it) => (
        <span className="text-sm">
          {it.costPrice != null ? formatPrice(it.costPrice) : "—"}
        </span>
      ),
    },
    {
      key: "defaultPrice",
      label: "Продаж",
      className: "w-28 text-right",
      hideOnMobile: true,
      render: (it) => (
        <span className="text-sm">
          {it.defaultPrice != null ? formatPrice(it.defaultPrice) : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <CrudPage<Row>
        title="Мій Склад"
        description="Товари та їхні залишки. Продажі автоматично списують залишок."
        items={visibleItems}
        loading={loading}
        searchableText={(it) => `${it.name} ${it.unit ?? ""} ${it.notes ?? ""}`}
        columns={columns}
        filterControl={
          usedCategories.length > 0 ? (
            <div className="md:w-64">
              <EntityCombobox
                items={usedCategories.map((c) => ({
                  id: c.id,
                  label: c.name,
                  swatch: c.color,
                }))}
                value={categoryFilter}
                onChange={(id) => setCategoryFilter(id)}
                placeholder="Усі категорії"
              />
            </div>
          ) : undefined
        }
        showAuthor
        onCreate={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
        onEdit={(it) => {
          setEditing(it);
          setDialogOpen(true);
        }}
        onDelete={handleDelete}
        deleteLabel={(it) => it.name}
        emptyTitle="Склад порожній"
        emptyDescription="Додайте перший товар і вкажіть його залишок."
      />

      {!loading && visibleItems.length > 0 && (
        <div className="container mx-auto -mt-2 px-4 pb-6">
          <Card size="sm" className="py-3">
            <CardContent className="flex flex-wrap items-center justify-around gap-4 py-0 text-center">
              <Stat label="Позицій" value={String(visibleItems.length)} />
              <Stat
                label="Усього одиниць"
                value={formatQty(totalUnits)}
              />
              <Stat
                label="Вартість складу (закуп.)"
                value={formatPrice(stockValue)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <InventoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        categories={categories}
        onSaved={reload}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[5rem]">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StockBadge({
  stock,
  unit,
}: {
  stock: number | undefined;
  unit: string;
}) {
  const v = stock ?? 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium tabular-nums",
        v <= 0
          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      )}
    >
      {formatQty(v)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

function StockText({
  stock,
  unit,
}: {
  stock: number | undefined;
  unit: string;
}) {
  const v = stock ?? 0;
  return (
    <span className={cn(v <= 0 && "text-red-600 dark:text-red-400")}>
      Залишок: {formatQty(v)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

function InventoryFormDialog({
  open,
  onOpenChange,
  initial,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Row | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("шт");
  const [stock, setStock] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>(NONE_VALUE);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setUnit(initial?.unit ?? "шт");
      setStock(initial?.stock != null ? String(initial.stock) : "");
      setCostPrice(
        initial?.costPrice != null ? String(initial.costPrice) : ""
      );
      setDefaultPrice(
        initial?.defaultPrice != null ? String(initial.defaultPrice) : ""
      );
      setDefaultCategoryId(initial?.defaultCategoryId ?? NONE_VALUE);
      setNotes(initial?.notes ?? "");
      setPhoto(initial?.photo ?? null);
    }
  }, [open, initial]);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // дозволяємо повторно вибрати той самий файл
    if (!file) return;
    setPhotoLoading(true);
    try {
      setPhoto(await imageToBase64Jpeg(file));
    } catch (err) {
      console.error(err);
      toast.error("Не вдалось обробити фото");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Введіть назву");
      return;
    }

    const parseMoney = (raw: string): number | null => {
      const t = raw.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isNaN(n) || n < 0 ? NaN : n;
    };

    const cost = parseMoney(costPrice);
    const price = parseMoney(defaultPrice);
    if (Number.isNaN(cost)) {
      toast.error("Невірна ціна закупівлі");
      return;
    }
    if (Number.isNaN(price)) {
      toast.error("Невірна ціна продажу");
      return;
    }

    const stockNum = stock.trim() === "" ? 0 : Number(stock);
    if (Number.isNaN(stockNum)) {
      toast.error("Невірний залишок");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim() || "шт",
        stock: stockNum,
        costPrice: cost,
        defaultPrice: price,
        defaultCategoryId:
          defaultCategoryId === NONE_VALUE ? null : defaultCategoryId,
        notes: notes.trim() || null,
        photo: photo ?? null,
      };
      if (initial) {
        await productsCrud.update(initial.id, payload);
        toast.success("Збережено");
      } else {
        await productsCrud.create(payload);
        toast.success("Товар додано");
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
            {initial ? "Редагувати товар" : "Новий товар"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="inv-name">Назва</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ефірна олія 10мл"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Фото</Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoPick}
            />
            {photo ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt="Фото товару"
                  className="h-32 w-32 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow"
                  aria-label="Видалити фото"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoLoading}
                className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {photoLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs">Додати фото</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inv-stock">Залишок</Label>
              <Input
                id="inv-stock"
                type="number"
                inputMode="decimal"
                step="any"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-unit">Од. виміру</Label>
              <Input
                id="inv-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                list="inv-unit-options"
                placeholder="шт"
              />
              <datalist id="inv-unit-options">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inv-cost">Ціна закупівлі, грн</Label>
              <Input
                id="inv-cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-price">Ціна продажу, грн</Label>
              <Input
                id="inv-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Категорія</Label>
            <Select
              value={defaultCategoryId}
              onValueChange={setDefaultCategoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Без категорії" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Без категорії</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-notes">Нотатки</Label>
            <Textarea
              id="inv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Напр., полиця, постачальник, особливості…"
              rows={2}
            />
          </div>

          <AuditInfo item={initial} />
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
            Зберегти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatPrice(v: number): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2,
  }).format(v);
}

function formatQty(v: number): string {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
  }).format(v);
}
