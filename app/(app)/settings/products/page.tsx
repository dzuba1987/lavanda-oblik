"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productsCrud, COMMON_UNITS } from "@/lib/data/products";
import { categoriesCrud } from "@/lib/data/categories";
import { AuditInfo } from "@/components/AuditInfo";
import type { Category, Product } from "@/lib/data/types";

type Row = Product;

const NONE_VALUE = "__none";

export default function ProductsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const columns: CrudColumn<Row>[] = [
    {
      key: "name",
      label: "Назва",
      render: (it) => (
        <div className="space-y-0.5">
          <div className="font-medium">{it.name}</div>
          {it.unit && (
            <div className="text-xs text-muted-foreground md:hidden">
              {it.unit}
              {it.defaultPrice != null && ` · ${formatPrice(it.defaultPrice)}`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "unit",
      label: "Од.",
      className: "w-20",
      hideOnMobile: true,
      render: (it) => (
        <span className="text-sm text-muted-foreground">{it.unit || "—"}</span>
      ),
    },
    {
      key: "price",
      label: "Ціна",
      className: "w-24 text-right",
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
        title="Товари"
        description="Прайс-лист продукції та послуг"
        backHref="/settings/"
        items={items}
        loading={loading}
        searchableText={(it) => `${it.name} ${it.unit ?? ""}`}
        columns={columns}
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
        emptyTitle="Жодного товару"
        emptyDescription="Створіть перший товар — напр., «Ефірна олія 10мл»."
      />

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        categories={categories}
        onSaved={reload}
      />
    </>
  );
}

function ProductFormDialog({
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
  const [defaultPrice, setDefaultPrice] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>(NONE_VALUE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setUnit(initial?.unit ?? "шт");
      setDefaultPrice(
        initial?.defaultPrice != null ? String(initial.defaultPrice) : ""
      );
      setDefaultCategoryId(initial?.defaultCategoryId ?? NONE_VALUE);
    }
  }, [open, initial]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Введіть назву");
      return;
    }
    const price = defaultPrice.trim() === "" ? null : Number(defaultPrice);
    if (price != null && (Number.isNaN(price) || price < 0)) {
      toast.error("Невірна ціна");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim() || "шт",
        defaultPrice: price,
        defaultCategoryId:
          defaultCategoryId === NONE_VALUE ? null : defaultCategoryId,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Редагувати товар" : "Новий товар"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="prod-name">Назва</Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ефірна олія 10мл"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="prod-unit">Од. виміру</Label>
              <Input
                id="prod-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                list="unit-options"
                placeholder="шт"
              />
              <datalist id="unit-options">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod-price">Ціна за замовч., грн</Label>
              <Input
                id="prod-price"
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
            <Label>Категорія за замовч.</Label>
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
