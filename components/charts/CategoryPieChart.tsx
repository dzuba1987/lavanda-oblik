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
          <li className="pt-1 text-xs text-muted-foreground">
            та ще {data.length - 6} категорій
          </li>
        )}
      </ul>
    </div>
  );
}
