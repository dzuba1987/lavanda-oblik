"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryBreakdownItem } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils/format";

export function CategoryPieChart({
  data,
  emptyText = "Немає даних за період",
}: {
  data: CategoryBreakdownItem[];
  emptyText?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-56 w-full sm:w-1/2">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
              formatter={(v) => formatMoney(Number(v))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex-1 space-y-1.5 text-sm">
        {data.slice(0, 6).map((item) => (
          <li key={item.categoryId} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.round(item.percent * 100)}%
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatMoney(item.value)}
            </span>
          </li>
        ))}
        {data.length > 6 && (
          <li className="group relative pt-1 text-xs text-muted-foreground">
            <button
              type="button"
              className="cursor-help underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none"
            >
              та ще {data.length - 6} категорій
            </button>
            <div className="invisible absolute bottom-full left-0 z-20 mb-1 min-w-[240px] rounded-md border bg-popover p-2 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <ul className="space-y-1">
                {data.slice(6).map((item) => (
                  <li
                    key={item.categoryId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.round(item.percent * 100)}%
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatMoney(item.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
