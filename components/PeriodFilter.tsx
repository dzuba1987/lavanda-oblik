"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type PeriodFilterProps = {
  preset: PeriodPreset;
  custom: PeriodRange;
  onChange: (preset: PeriodPreset, custom: PeriodRange) => void;
};

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

  return (
    <div className="flex items-center gap-2">
      <Select
        value={preset}
        onValueChange={(v) => onChange(v as PeriodPreset, custom)}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["month", "quarter", "year", "all", "custom"] as PeriodPreset[]).map(
            (p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {custom.from || custom.to ? (
                <>
                  {custom.from ? formatDate(custom.from) : "…"}
                  {" — "}
                  {custom.to ? formatDate(custom.to) : "…"}
                </>
              ) : (
                "Обрати"
              )}
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
      )}
    </div>
  );
}
