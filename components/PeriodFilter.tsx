"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PERIOD_LABELS,
  type PeriodPreset,
  type PeriodRange,
} from "@/lib/utils/period";
import { toInputDate, fromInputDate, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type PeriodFilterProps = {
  preset: PeriodPreset;
  custom: PeriodRange;
  onChange: (preset: PeriodPreset, custom: PeriodRange) => void;
};

// Усі пресети як видимі pills + окрема кнопка "Період" для custom range.
const QUICK: { value: PeriodPreset; label: string }[] = [
  { value: "month", label: PERIOD_LABELS.month },
  { value: "quarter", label: PERIOD_LABELS.quarter },
  { value: "year", label: PERIOD_LABELS.year },
  { value: "all", label: PERIOD_LABELS.all },
];

export function PeriodFilter({ preset, custom, onChange }: PeriodFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(toInputDate(custom.from));
  const [to, setTo] = useState(toInputDate(custom.to));

  function handleApplyCustom() {
    const f = fromInputDate(from);
    const t = fromInputDate(to);
    if (t) t.setHours(23, 59, 59, 999);
    onChange("custom", { from: f, to: t });
    setCustomOpen(false);
  }

  const customLabel = custom.from || custom.to
    ? `${custom.from ? formatDate(custom.from) : "…"} — ${custom.to ? formatDate(custom.to) : "…"}`
    : "Період";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {QUICK.map((q) => (
        <Button
          key={q.value}
          type="button"
          size="sm"
          variant={preset === q.value ? "default" : "outline"}
          className={cn(
            "h-8 px-3 text-xs",
            preset === q.value && "bg-violet-600 hover:bg-violet-700"
          )}
          onClick={() => onChange(q.value, custom)}
        >
          {q.label}
        </Button>
      ))}

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={preset === "custom" ? "default" : "outline"}
            className={cn(
              "h-8 gap-1.5 px-3 text-xs",
              preset === "custom" && "bg-violet-600 hover:bg-violet-700"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {preset === "custom" ? customLabel : "Період"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="period-from">З</Label>
            <Input
              id="period-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to">До</Label>
            <Input
              id="period-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button
            onClick={handleApplyCustom}
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            Застосувати
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
