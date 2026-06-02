"use client";

import { useState } from "react";
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
  // Серії, приховані кліком по легенді.
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (meta.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  const nameById = new Map(meta.map((m) => [m.categoryId, m.name]));

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            // Кастомний тултіп: обмежена ширина/висота + перенос довгих назв,
            // інакше дефолтний recharts-тултіп розповзається на весь екран.
            content={<CategoryTooltip nameById={nameById} />}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            onClick={(entry) => {
              const e = entry as { dataKey?: unknown; value?: unknown };
              toggle(String(e.dataKey ?? e.value));
            }}
            formatter={(value, entry) => {
              const e = entry as { dataKey?: unknown } | undefined;
              const id = String(e?.dataKey ?? value);
              const isHidden = hidden.has(id);
              return (
                <span
                  style={{
                    cursor: "pointer",
                    opacity: isHidden ? 0.4 : 1,
                    textDecoration: isHidden ? "line-through" : undefined,
                  }}
                >
                  {nameById.get(id) ?? String(value)}
                </span>
              );
            }}
          />
          {meta.map((m) => (
            <Bar
              key={m.categoryId}
              dataKey={m.categoryId}
              stackId="all"
              fill={m.color}
              radius={[0, 0, 0, 0]}
              hide={hidden.has(m.categoryId)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
  color?: string;
};

function CategoryTooltip({
  active,
  payload,
  label,
  nameById,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  nameById: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Лише ненульові серії — стопка містить десятки категорій, більшість = 0.
  const items = payload.filter((p) => Number(p.value ?? 0) !== 0);
  if (items.length === 0) return null;
  const total = items.reduce((s, p) => s + Number(p.value ?? 0), 0);

  return (
    <div className="max-h-64 max-w-[min(280px,80vw)] overflow-y-auto rounded-lg border bg-card p-2.5 text-xs shadow-md">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      <ul className="space-y-1">
        {items.map((p) => (
          <li key={String(p.dataKey)} className="flex items-start gap-1.5">
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: p.color }}
            />
            <span className="min-w-0 flex-1 break-words text-muted-foreground">
              {nameById.get(String(p.dataKey)) ?? String(p.name)}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {formatMoney(Number(p.value))}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex justify-between gap-2 border-t pt-1 font-medium text-foreground">
        <span>Разом</span>
        <span className="tabular-nums">{formatMoney(total)}</span>
      </div>
    </div>
  );
}

function compact(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}к`;
  return String(Math.round(v));
}
