"use client";

import type { CounterpartyRanking } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils/format";

export function TopCounterpartiesChart({
  data,
  color = "violet",
  emptyText = "Немає даних",
}: {
  data: CounterpartyRanking[];
  color?: "violet" | "emerald" | "red";
  emptyText?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  const max = data[0]?.value ?? 0;
  const colorClass = {
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
  }[color];

  return (
    <ul className="space-y-2.5">
      {data.map((item, idx) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <li key={item.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-2 inline-block w-5 text-xs text-muted-foreground tabular-nums">
                  #{idx + 1}
                </span>
                <span className="font-medium">{item.name}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(item.value)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${colorClass}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {item.count} опер.
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
