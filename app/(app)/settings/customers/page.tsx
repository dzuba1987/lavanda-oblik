"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AuditInfo } from "@/components/AuditInfo";
import { customersCrud } from "@/lib/data/customers";
import type { Customer } from "@/lib/data/types";

type Row = Customer;

const COMMON_SOURCES = [
  "Інстаграм",
  "Сарафанне радіо",
  "Майстер-клас",
  "Прохожі",
  "Укрпошта",
  "Нова Пошта",
  "Постійний клієнт",
];

export default function CustomersPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const rows = await customersCrud.list();
      setItems(rows as Row[]);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити клієнтів");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(row: Row) {
    try {
      await customersCrud.remove(row.id);
      toast.success("Клієнта видалено");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось видалити");
    }
  }

  const columns: CrudColumn<Row>[] = [
    {
      key: "name",
      label: "Ім'я",
      render: (it) => (
        <div className="space-y-0.5">
          <div className="font-medium">{it.name}</div>
          {(it.age != null || it.source || it.phone) && (
            <div className="text-xs text-muted-foreground md:hidden">
              {it.age != null && `${it.age} р.`}
              {it.age != null && (it.source || it.phone) && " · "}
              {it.source}
              {it.source && it.phone && " · "}
              {it.phone && (
                <a
                  href={`tel:${it.phone.replace(/\s/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-violet-600 hover:underline"
                >
                  {it.phone}
                </a>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      label: "Телефон",
      hideOnMobile: true,
      render: (it) =>
        it.phone ? (
          <a
            href={`tel:${it.phone.replace(/\s/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"
          >
            <Phone className="h-3 w-3" />
            {it.phone}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "age",
      label: "Вік",
      className: "w-16",
      hideOnMobile: true,
      render: (it) => (
        <span className="text-sm text-muted-foreground">
          {it.age != null ? it.age : "—"}
        </span>
      ),
    },
    {
      key: "source",
      label: "Звідки",
      hideOnMobile: true,
      render: (it) => (
        <span className="text-sm text-muted-foreground">
          {it.source || "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <CrudPage<Row>
        title="Клієнти"
        description="Покупці продукції"
        backHref="/settings/"
        items={items}
        loading={loading}
        searchableText={(it) =>
          `${it.name} ${it.source ?? ""} ${it.phone ?? ""} ${it.notes ?? ""}`
        }
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
        emptyTitle="Жодного клієнта"
        emptyDescription="Додайте першого — клієнти автоматично створюватимуться при імпорті продажів."
      />

      <CustomerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        existing={items}
        onSaved={reload}
      />
    </>
  );
}

function CustomerFormDialog({
  open,
  onOpenChange,
  initial,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Row | null;
  existing: Row[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [source, setSource] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAge(initial?.age != null ? String(initial.age) : "");
      setSource(initial?.source ?? "");
      setPhone(initial?.phone ?? "");
      setAddress(initial?.address ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Введіть ім'я");
      return;
    }
    // Блок дублів: та сама нормалізація, що в import і дедупі
    // (trim + lower + згортання пробілів). При редагуванні ігноруємо самого себе.
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const key = norm(name);
    const clash = existing.find(
      (c) => c.id !== initial?.id && norm(c.name) === key
    );
    if (clash) {
      toast.error(`Клієнт «${clash.name}» вже існує`);
      return;
    }
    const parsedAge = age.trim() === "" ? null : Number(age);
    if (parsedAge != null && (Number.isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150)) {
      toast.error("Невірний вік");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        age: parsedAge,
        source: source.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };
      if (initial) {
        await customersCrud.update(initial.id, payload);
        toast.success("Збережено");
      } else {
        await customersCrud.create(payload);
        toast.success("Клієнта додано");
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
            {initial ? "Редагувати клієнта" : "Новий клієнт"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="cust-name">Ім&apos;я</Label>
            <Input
              id="cust-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ірина Василюк"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cust-phone">Телефон (опц.)</Label>
            <Input
              id="cust-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+380 00 000 00 00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cust-age">Вік (опц.)</Label>
              <Input
                id="cust-age"
                type="number"
                inputMode="numeric"
                min="0"
                max="150"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cust-source">Звідки про нас</Label>
              <Input
                id="cust-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                list="source-options"
                placeholder="Інстаграм"
              />
              <datalist id="source-options">
                {COMMON_SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cust-address">Адреса (опц.)</Label>
            <Input
              id="cust-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="м. Київ, вул. Хрещатик, 1, кв. 5"
            />
            <p className="text-xs text-muted-foreground">
              Підставлятиметься як адреса доставки за замовчуванням у нових замовленнях.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cust-notes">Нотатки (опц.)</Label>
            <Textarea
              id="cust-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
