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
import type { MonthlyBucket } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils/format";

export function IncomeExpenseChart({ data }: { data: MonthlyBucket[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => compactMoney(Number(v))}
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            width={56}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatMoney(Number(value)),
              name === "income" ? "Дохід" : "Витрата",
            ]}
            labelClassName="font-medium"
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (value === "income" ? "Дохід" : "Витрата")}
          />
          <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function compactMoney(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}к`;
  return String(Math.round(v));
}
