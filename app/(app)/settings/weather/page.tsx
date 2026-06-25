"use client";

import { useEffect, useState } from "react";
import { Cloud, Check, MapPin } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useWeatherProvider,
  owmConfigured,
  WEATHER_PROVIDER_META,
  weatherMeta,
  fetchDayWeather,
  DEFAULT_LOCATION,
  type WeatherProvider,
  type DayWeather,
} from "@/lib/utils/weather";

const PROVIDERS: {
  key: WeatherProvider;
  desc: string;
}[] = [
  {
    key: "open-meteo",
    desc: "Безкоштовний, без ключа. ~16 днів уперед. Джерело сходу/заходу сонця.",
  },
  {
    key: "openweathermap",
    desc: "Потрібен API-ключ. Прогноз 5 днів / крок 3 год. Для порівняння.",
  },
];

export default function WeatherSettingsPage() {
  const [provider, setProvider] = useWeatherProvider();
  const canOwm = owmConfigured();

  // Детальний прогноз на 7 днів для обох провайдерів (для порівняння).
  const [week, setWeek] = useState<
    {
      day: Date;
      "open-meteo": DayWeather | null;
      openweathermap: DayWeather | null;
    }[]
  >([]);
  useEffect(() => {
    let alive = true;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    });
    Promise.all(
      days.map(async (d) => ({
        day: d,
        "open-meteo": await fetchDayWeather(d, DEFAULT_LOCATION, "open-meteo"),
        openweathermap: canOwm
          ? await fetchDayWeather(d, DEFAULT_LOCATION, "openweathermap")
          : null,
      }))
    ).then((rows) => {
      if (alive) setWeek(rows);
    });
    return () => {
      alive = false;
    };
  }, [canOwm]);

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Погода</h1>
        <p className="text-sm text-muted-foreground">
          Провайдер прогнозу для календаря фотосесій
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-violet-600" />
            <h2 className="text-base font-medium">Джерело прогнозу</h2>
          </div>

          <div className="space-y-2">
            {PROVIDERS.map((p) => {
              const active = provider === p.key;
              const disabled = p.key === "openweathermap" && !canOwm;
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setProvider(p.key)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                      : "hover:bg-accent",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      active
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {WEATHER_PROVIDER_META[p.key].label}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                    {disabled && (
                      <div className="mt-1 text-xs text-amber-600">
                        Додайте NEXT_PUBLIC_OPENWEATHER_KEY у .env.local
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {DEFAULT_LOCATION.label} · {DEFAULT_LOCATION.lat.toFixed(4)},{" "}
            {DEFAULT_LOCATION.lon.toFixed(4)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 px-4 py-4">
          <h2 className="text-base font-medium">
            Порівняння прогнозу · 7 днів
          </h2>
          <p className="text-xs text-muted-foreground">
            OpenWeatherMap покриває лише ~5 днів уперед.
          </p>

          {/* Заголовок колонок */}
          <div className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 border-b pb-1 text-xs font-medium text-muted-foreground">
            <span>День</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5",
                provider === "open-meteo" &&
                  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
              )}
            >
              {WEATHER_PROVIDER_META["open-meteo"].label}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5",
                provider === "openweathermap" &&
                  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
              )}
            >
              {WEATHER_PROVIDER_META.openweathermap.label}
            </span>
          </div>

          <div className="divide-y">
            {week.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Завантаження…
              </p>
            ) : (
              week.map((row, i) => {
                const om = row["open-meteo"];
                const owm = row.openweathermap;
                const diff =
                  om?.code != null &&
                  owm?.code != null &&
                  weatherMeta(om.code).label !== weatherMeta(owm.code).label;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 py-2 text-sm"
                  >
                    <span className="text-xs font-medium capitalize">
                      {i === 0
                        ? "Сьогодні"
                        : format(row.day, "EEE, d MMM", { locale: uk })}
                    </span>
                    <ProviderCell w={om} />
                    <ProviderCell w={owm} highlight={diff} disabled={!canOwm} />
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ProviderCell({
  w,
  highlight,
  disabled,
}: {
  w: DayWeather | null;
  highlight?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (!w?.hasWeather) {
    return <span className="text-xs text-muted-foreground">немає даних</span>;
  }
  const m = weatherMeta(w.code ?? null);
  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        highlight && "font-medium text-amber-600 dark:text-amber-400"
      )}
    >
      <span className="text-lg leading-none">{m.emoji}</span>
      <span className="min-w-0 truncate text-xs">{m.label}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
        {w.tempMax != null ? fmtTemp(w.tempMax) : "—"}
        {w.precipProb != null && w.precipProb > 0 ? ` 💧${w.precipProb}%` : ""}
      </span>
    </div>
  );
}

function fmtTemp(t: number): string {
  const r = Math.round(t);
  return `${r > 0 ? "+" : ""}${r}°`;
}
