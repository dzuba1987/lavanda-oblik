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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { categoriesCrud, DEFAULT_CATEGORY_COLORS } from "@/lib/data/categories";
import type { Category, TransactionType } from "@/lib/data/types";

type Row = Category;

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Дохід",
  expense: "Витрата",
};

export default function CategoriesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const rows = await categoriesCrud.list();
      setItems(rows as Row[]);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити категорії");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleDelete(row: Row) {
    try {
      await categoriesCrud.remove(row.id);
      toast.success("Категорію видалено");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось видалити");
    }
  }

  const columns: CrudColumn<Row>[] = [
    {
      key: "color",
      label: "",
      className: "w-12",
      render: (it) => (
        <div
          className="h-5 w-5 rounded-md border"
          style={{ backgroundColor: it.color }}
          aria-hidden
        />
      ),
    },
    {
      key: "name",
      label: "Назва",
      render: (it) => <div className="font-medium">{it.name}</div>,
    },
    {
      key: "type",
      label: "Тип",
      className: "w-32",
      render: (it) => (
        <Badge
          variant={it.type === "income" ? "default" : "secondary"}
          className={cn(
            it.type === "income"
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-200"
          )}
        >
          {TYPE_LABELS[it.type]}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <CrudPage<Row>
        title="Категорії"
        description="Розділяють доходи та витрати"
        backHref="/settings/"
        items={items}
        loading={loading}
        searchableText={(it) => `${it.name} ${TYPE_LABELS[it.type]}`}
        columns={columns}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        deleteLabel={(it) => it.name}
        emptyTitle="Жодної категорії"
        emptyDescription="Створіть першу категорію — наприклад «Продукція» або «Господарчі витрати»."
      />

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={reload}
      />
    </>
  );
}

function CategoryFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Row | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setType((initial?.type as TransactionType) ?? "expense");
      setColor(initial?.color ?? DEFAULT_CATEGORY_COLORS[0]);
    }
  }, [open, initial]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Введіть назву");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        color,
        sortOrder: initial?.sortOrder ?? 0,
      };
      if (initial) {
        await categoriesCrud.update(initial.id, payload);
        toast.success("Збережено");
      } else {
        await categoriesCrud.create(payload);
        toast.success("Категорію додано");
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
            {initial ? "Редагувати категорію" : "Нова категорія"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="cat-name">Назва</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр., Сировина та матеріали"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Тип</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Дохід</SelectItem>
                <SelectItem value="expense">Витрата</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Колір</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Колір ${c}`}
                  className={cn(
                    "h-8 w-8 rounded-md border-2 transition-transform",
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
            Зберегти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
