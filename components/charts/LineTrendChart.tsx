"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyBucket } from "@/lib/analytics";
import { formatMoney } from "@/lib/utils/format";
import { CHART_COLORS, LEGEND_LABEL_STYLE } from "@/lib/charts/palette";

export function LineTrendChart({ data }: { data: MonthlyBucket[] }) {
  return (
    <div className="h-72 w-full">
      {/* initialDimension: без нього recharts стартує з {-1,-1} і до першого
          спрацювання ResizeObserver пише в консоль «width(-1) and height(-1)».
          Значення — приблизні, RO одразу замінює їх на фактичні. */}
      <ResponsiveContainer initialDimension={{ width: 600, height: 288 }}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
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
              name === "income"
                ? "Дохід"
                : name === "expense"
                  ? "Витрата"
                  : "Чистий",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (
              <span style={LEGEND_LABEL_STYLE}>
                {value === "income"
                  ? "Дохід"
                  : value === "expense"
                    ? "Витрата"
                    : "Чистий"}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke={CHART_COLORS.income}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke={CHART_COLORS.expense}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke={CHART_COLORS.net}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function compact(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}к`;
  return String(Math.round(v));
}
