"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  StackedCategoryMeta,
  StackedCategoryRow,
} from "@/lib/analytics";
import { formatMoney } from "@/lib/utils/format";

export function StackedCategoryChart({
  rows,
  meta,
  emptyText = "Немає даних",
}: {
  rows: StackedCategoryRow[];
  meta: StackedCategoryMeta[];
  emptyText?: string;
}) {
  if (meta.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  const nameById = new Map(meta.map((m) => [m.categoryId, m.name]));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => compact(Number(v))}
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            width={56}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatMoney(Number(value)),
              nameById.get(String(name)) ?? String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => nameById.get(String(value)) ?? String(value)}
          />
          {meta.map((m) => (
            <Bar
              key={m.categoryId}
              dataKey={m.categoryId}
              stackId="all"
              fill={m.color}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function compact(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}к`;
  return String(Math.round(v));
}
