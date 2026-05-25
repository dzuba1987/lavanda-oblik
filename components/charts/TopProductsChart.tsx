"use client";

import type { ProductRanking } from "@/lib/analytics";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export function TopProductsChart({
  data,
  emptyText = "Немає даних",
}: {
  data: ProductRanking[];
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

  return (
    <ul className="space-y-3">
      {data.map((item, idx) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <li key={item.productId} className="space-y-1">
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
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatNumber(item.quantity)} од · {item.count} прод.
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
