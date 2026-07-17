"use client";

import { useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboItem = {
  id: string;
  label: string;
  hint?: string;
  swatch?: string;
};

export type EntityComboboxProps = {
  items: ComboItem[];
  value: string | null;
  onChange: (id: string | null, item: ComboItem | null) => void;
  placeholder?: string;
  emptyText?: string;
  /** Якщо передано — показує кнопку «Створити X» коли пошук не дає збігів */
  onCreate?: (label: string) => Promise<ComboItem>;
  /** Чи дозволяти очистити вибір */
  clearable?: boolean;
  disabled?: boolean;
};

export function EntityCombobox({
  items,
  value,
  onChange,
  placeholder = "Оберіть…",
  emptyText = "Нічого не знайдено",
  onCreate,
  clearable = true,
  disabled = false,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const touchRef = useRef<{ y: number; scrollTop: number } | null>(null);

  const selected = items.find((i) => i.id === value) ?? null;
  const trimmed = search.trim();
  // Нормалізація мусить збігатися з import (lib/excel/runImport.ts) і дедупом
  // (lib/data/dedupeCustomers.ts): trim + lower + згортання пробілів. Інакше
  // «Інна  прогулянка» (2 пробіли) вважалась би новою і плодила б дублі.
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const hasExact = items.some((i) => norm(i.label) === norm(search));

  async function handleCreate() {
    if (!onCreate || !trimmed) return;
    setCreating(true);
    try {
      const newItem = await onCreate(trimmed);
      onChange(newItem.id, newItem);
      setOpen(false);
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  // Усередині модального Dialog react-remove-scroll preventDefault'ить wheel
  // events на portal-овані діти Popover. Browser default scroll блокується,
  // тому скролимо CommandList програмно — preventDefault не зупиняє JS.
  // Альтернатива з `modal` на Popover ламала скрол самої форми Dialog'у.
  function handleListWheel(e: React.WheelEvent<HTMLDivElement>) {
    const list = e.currentTarget;
    if (list.scrollHeight > list.clientHeight) {
      list.scrollTop += e.deltaY;
    }
  }

  // Та сама причина для тача: react-remove-scroll preventDefault'ить touchmove
  // на порталі Popover, тож нативний свайп-скрол не працює на мобільному
  // (бачимо лише рух підсвітки cmdk). Скролимо CommandList програмно за дельтою
  // дотику — preventDefault не зупиняє наш JS-обробник.
  function handleListTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchRef.current = {
      y: e.touches[0].clientY,
      scrollTop: e.currentTarget.scrollTop,
    };
  }

  function handleListTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const list = e.currentTarget;
    const start = touchRef.current;
    if (!start || list.scrollHeight <= list.clientHeight) return;
    list.scrollTop = start.scrollTop + (start.y - e.touches[0].clientY);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground"
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.swatch && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: selected.swatch }}
              />
            )}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Пошук…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList
            className="max-h-(--radix-popover-content-available-height)"
            onWheel={handleListWheel}
            onTouchStart={handleListTouchStart}
            onTouchMove={handleListTouchMove}
          >
            <CommandEmpty>
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {emptyText}
              </p>
            </CommandEmpty>
            <CommandGroup>
              {clearable && selected && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">Очистити вибір</span>
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.hint ?? ""}`}
                  onSelect={() => {
                    onChange(item.id, item);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.swatch && (
                    <span
                      className="mr-2 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.swatch }}
                    />
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {onCreate && trimmed && !hasExact && (
            <div className="border-t border-violet-200 bg-violet-50 p-1.5 dark:border-violet-900 dark:bg-violet-950/40">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-2 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                onClick={handleCreate}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Створити «{trimmed}»
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
