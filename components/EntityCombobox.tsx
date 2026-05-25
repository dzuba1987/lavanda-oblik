"use client";

import { useState } from "react";
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

  const selected = items.find((i) => i.id === value) ?? null;
  const trimmed = search.trim();
  const hasExact = items.some(
    (i) => i.label.toLowerCase() === trimmed.toLowerCase()
  );

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
          <CommandList>
            <CommandEmpty>
              {onCreate && trimmed ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Створити «{trimmed}»
                </button>
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {emptyText}
                </p>
              )}
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
              {onCreate && trimmed && !hasExact && items.length > 0 && (
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Створити «{trimmed}»
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
