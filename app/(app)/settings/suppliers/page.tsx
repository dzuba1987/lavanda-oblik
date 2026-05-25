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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { suppliersCrud } from "@/lib/data/suppliers";
import type { Supplier } from "@/lib/data/types";

type Row = Supplier;

export default function SuppliersPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const rows = await suppliersCrud.list();
      setItems(rows as Row[]);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити постачальників");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(row: Row) {
    try {
      await suppliersCrud.remove(row.id);
      toast.success("Постачальника видалено");
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
          {it.contact && (
            <div className="text-xs text-muted-foreground md:hidden">
              {it.contact}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      label: "Контакт",
      hideOnMobile: true,
      render: (it) => (
        <span className="text-sm text-muted-foreground">
          {it.contact || "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <CrudPage<Row>
        title="Постачальники"
        description="Магазини, ринки, оптовики"
        backHref="/settings/"
        items={items}
        loading={loading}
        searchableText={(it) => `${it.name} ${it.contact ?? ""} ${it.notes ?? ""}`}
        columns={columns}
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
        emptyTitle="Жодного постачальника"
        emptyDescription="Додайте першого — напр., «Агровін» чи «магазин Жива земля»."
      />

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={reload}
      />
    </>
  );
}

function SupplierFormDialog({
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
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setContact(initial?.contact ?? "");
      setNotes(initial?.notes ?? "");
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
        contact: contact.trim() || null,
        notes: notes.trim() || null,
      };
      if (initial) {
        await suppliersCrud.update(initial.id, payload);
        toast.success("Збережено");
      } else {
        await suppliersCrud.create(payload);
        toast.success("Постачальника додано");
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
            {initial ? "Редагувати постачальника" : "Новий постачальник"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="sup-name">Назва</Label>
            <Input
              id="sup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Агровін"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sup-contact">Контакт (опц.)</Label>
            <Input
              id="sup-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Телефон, email або посилання"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sup-notes">Нотатки (опц.)</Label>
            <Textarea
              id="sup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
            Зберегти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
