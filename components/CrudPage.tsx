"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AuditFields } from "@/lib/data/types";
import { formatRelative } from "@/lib/utils/format";

export type CrudColumn<T> = {
  key: string;
  label: string;
  className?: string;
  hideOnMobile?: boolean;
  render: (item: T) => React.ReactNode;
};

export type CrudPageProps<T extends { id: string }> = {
  title: string;
  description?: string;
  backHref?: string;
  items: T[];
  loading: boolean;
  searchPlaceholder?: string;
  searchableText: (item: T) => string;
  columns: CrudColumn<T>[];
  /**
   * Якщо true і елементи задовольняють AuditFields — рендериться окрема колонка
   * "Автор" з ім'ям того, хто останнім редагував + відносна дата.
   */
  showAuthor?: boolean;
  onCreate: () => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => Promise<void>;
  deleteLabel?: (item: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function CrudPage<T extends { id: string }>(props: CrudPageProps<T>) {
  const {
    title,
    description,
    backHref,
    items,
    loading,
    searchPlaceholder = "Пошук…",
    searchableText,
    columns,
    showAuthor = false,
    onCreate,
    onEdit,
    onDelete,
    deleteLabel,
    emptyTitle = "Поки нічого нема",
    emptyDescription = "Додайте перший запис натиснувши кнопку нижче.",
  } = props;

  const allColumns: CrudColumn<T>[] = showAuthor
    ? [
        ...columns,
        {
          key: "__author__",
          label: "Автор",
          hideOnMobile: true,
          className: "w-44",
          render: (it) => {
            const a = it as T & AuditFields;
            const name =
              a.updatedByName ?? a.createdByName ?? null;
            const ts = a.updatedAt ?? a.createdAt;
            if (!name && !ts) {
              return <span className="text-sm text-muted-foreground">—</span>;
            }
            return (
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="truncate">{name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(ts)}
                </span>
              </div>
            );
          },
        },
      ]
    : columns;

  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => searchableText(it).toLowerCase().includes(q));
  }, [items, search, searchableText]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {backHref && (
            <Button asChild variant="ghost" size="icon" className="-ml-2 h-8 w-8">
              <Link href={backHref} aria-label="Назад">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="truncate text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <Button onClick={onCreate} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-1 h-4 w-4" /> Додати
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-base font-medium">
              {search ? "Нічого не знайдено" : emptyTitle}
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              {search
                ? "Спробуйте інший пошуковий запит."
                : emptyDescription}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    {allColumns.map((c) => (
                      <th
                        key={c.key}
                        className={cn("px-4 py-2 font-medium", c.className)}
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onEdit(item)}
                      className="cursor-pointer border-b last:border-b-0 hover:bg-accent/50"
                    >
                      {allColumns.map((c) => (
                        <td
                          key={c.key}
                          className={cn("px-4 py-2", c.className)}
                        >
                          {c.render(item)}
                        </td>
                      ))}
                      <td
                        className="px-2 py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions
                          variant="inline"
                          onEdit={() => onEdit(item)}
                          onDelete={() => setPendingDelete(item)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y md:hidden">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                  >
                    {columns
                      .filter((c) => !c.hideOnMobile)
                      .map((c) => (
                        <div key={c.key} className="text-sm">
                          {c.render(item)}
                        </div>
                      ))}
                  </button>
                  <RowActions
                    onEdit={() => onEdit(item)}
                    onDelete={() => setPendingDelete(item)}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити запис?</DialogTitle>
            <DialogDescription>
              {pendingDelete && deleteLabel
                ? `«${deleteLabel(pendingDelete)}» буде видалено остаточно. Цю дію не можна скасувати.`
                : "Цю дію не можна скасувати."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Видалити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function RowActions({
  onEdit,
  onDelete,
  variant = "menu",
}: {
  onEdit: () => void;
  onDelete: () => void;
  /** "inline" — кнопки одразу в рядку (десктоп); "menu" — під меню "⋮" (мобільна). */
  variant?: "menu" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label="Редагувати"
          title="Редагувати"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Видалити"
          title="Видалити"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Дії"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Редагувати
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Видалити
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
