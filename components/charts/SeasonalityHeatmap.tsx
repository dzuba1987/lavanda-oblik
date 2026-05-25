"use client";

import { MONTH_SHORT_LABELS, type HeatmapData } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function SeasonalityHeatmap({
  data,
  baseColor = "violet",
  emptyText = "Немає даних",
}: {
  data: HeatmapData;
  baseColor?: "violet" | "emerald" | "red";
  emptyText?: string;
}) {
  if (data.years.length === 0 || data.max === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  const cellByKey = new Map(
    data.cells.map((c) => [`${c.year}-${c.month}`, c.value])
  );

  return (
    <div className="overflow-x-auto">
      <div
        className="grid w-full text-xs"
        style={{
          gridTemplateColumns: `auto repeat(12, minmax(28px, 1fr))`,
          gap: 4,
        }}
      >
        <div />
        {MONTH_SHORT_LABELS.map((m) => (
          <div
            key={m}
            className="text-center text-[10px] uppercase text-muted-foreground"
          >
            {m}
          </div>
        ))}

        {data.years.map((year) => (
          <YearRow
            key={year}
            year={year}
            getCell={(month) => cellByKey.get(`${year}-${month}`) ?? 0}
            max={data.max}
            baseColor={baseColor}
          />
        ))}
      </div>

      <Legend baseColor={baseColor} max={data.max} />
    </div>
  );
}

function YearRow({
  year,
  getCell,
  max,
  baseColor,
}: {
  year: number;
  getCell: (month: number) => number;
  max: number;
  baseColor: "violet" | "emerald" | "red";
}) {
  return (
    <>
      <div className="flex items-center pr-2 font-medium text-muted-foreground tabular-nums">
        {year}
      </div>
      {Array.from({ length: 12 }).map((_, m) => {
        const v = getCell(m);
        const intensity = max > 0 ? v / max : 0;
        return (
          <div
            key={m}
            className={cn(
              "group relative aspect-square rounded-sm",
              v === 0 && "bg-muted/40"
            )}
            style={
              v > 0
                ? {
                    backgroundColor: colorFor(baseColor, intensity),
                  }
                : undefined
            }
            title={`${MONTH_SHORT_LABELS[m]} ${year}: ${formatMoney(v)}`}
          />
        );
      })}
    </>
  );
}

function Legend({
  baseColor,
  max,
}: {
  baseColor: "violet" | "emerald" | "red";
  max: number;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <span>0</span>
      <div className="flex gap-0.5">
        {[0.1, 0.25, 0.5, 0.75, 1].map((p) => (
          <div
            key={p}
            className="h-3 w-4 rounded-sm"
            style={{ backgroundColor: colorFor(baseColor, p) }}
          />
        ))}
      </div>
      <span>{formatMoney(max)}</span>
    </div>
  );
}

function colorFor(
  base: "violet" | "emerald" | "red",
  intensity: number
): string {
  const clamp = Math.max(0.08, Math.min(1, intensity));
  const colors = {
    violet: [124, 92, 187], // #7c5cbb
    emerald: [16, 185, 129], // #10b981
    red: [239, 68, 68], // #ef4444
  } as const;
  const [r, g, b] = colors[base];
  return `rgba(${r}, ${g}, ${b}, ${clamp})`;
}
