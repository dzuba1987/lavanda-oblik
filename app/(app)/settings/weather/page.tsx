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
  metnoConfigured,
  WEATHER_PROVIDER_META,
  weatherMeta,
  fetchDayWeather,
  DEFAULT_LOCATION,
  type WeatherProvider,
  type DayWeather,
} from "@/lib/utils/weather";
import {
  logWeatherForecasts,
  loadScoredLog,
  scoreLog,
  type ProviderScore,
} from "@/lib/data/weatherLog";

const PROVIDER_INFO: Record<
  WeatherProvider,
  { desc: string; hint?: string }
> = {
  "open-meteo": {
    desc: "Безкоштовний, без ключа. ~16 днів уперед. Джерело сходу/заходу сонця.",
  },
  openweathermap: {
    desc: "Прогноз 5 днів / крок 3 год. Станційні дані.",
    hint: "Додайте NEXT_PUBLIC_OPENWEATHER_KEY у .env.local",
  },
  metno: {
    desc: "Норвезька метеослужба (yr.no). Через бекенд-проксі, незалежна модель.",
    hint: "Потрібен налаштований бекенд invest-notify (NOTIFY_API_*)",
  },
};

// OpenWeatherMap прибрано зі списку — давав неточний прогноз для локації.
const ALL_PROVIDERS: WeatherProvider[] = ["open-meteo", "metno"];

export default function WeatherSettingsPage() {
  const [provider, setProvider] = useWeatherProvider();
  const canOwm = owmConfigured();
  const canMet = metnoConfigured();

  const isAvailable = (p: WeatherProvider) =>
    p === "open-meteo" ||
    (p === "openweathermap" && canOwm) ||
    (p === "metno" && canMet);

  const available = ALL_PROVIDERS.filter(isAvailable);

  // Логер точності: записати прогнози + факт (тротлиться раз/добу), тоді скор.
  const [scores, setScores] = useState<ProviderScore[] | null>(null);
  useEffect(() => {
    let alive = true;
    logWeatherForecasts(available)
      .then(() => loadScoredLog())
      .then((docs) => {
        if (alive) setScores(scoreLog(docs, available));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOwm, canMet]);

  // Детальний прогноз на 7 днів для всіх доступних провайдерів (порівняння).
  const [week, setWeek] = useState<
    { day: Date; wx: Partial<Record<WeatherProvider, DayWeather | null>> }[]
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
      days.map(async (d) => {
        const wx: Partial<Record<WeatherProvider, DayWeather | null>> = {};
        for (const p of available) {
          wx[p] = await fetchDayWeather(d, DEFAULT_LOCATION, p);
        }
        return { day: d, wx };
      })
    ).then((rows) => {
      if (alive) setWeek(rows);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOwm, canMet]);

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
            {ALL_PROVIDERS.map((p) => {
              const active = provider === p;
              const disabled = !isAvailable(p);
              const info = PROVIDER_INFO[p];
              return (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => setProvider(p)}
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
                      {WEATHER_PROVIDER_META[p].label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {info.desc}
                    </div>
                    {disabled && info.hint && (
                      <div className="mt-1 text-xs text-amber-600">
                        {info.hint}
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
          <h2 className="text-base font-medium">Порівняння прогнозу · 7 днів</h2>
          <p className="text-xs text-muted-foreground">
            Open-Meteo ~16 днів, Met.no ~9 днів уперед.
          </p>

          {week.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Завантаження…</p>
          ) : (
            <>
              {/* Заголовок: колонка на кожен провайдер */}
              <div
                className="grid items-center gap-2 border-b pb-1 text-xs font-medium text-muted-foreground"
                style={{
                  gridTemplateColumns: `6rem repeat(${available.length}, minmax(0,1fr))`,
                }}
              >
                <span>День</span>
                {available.map((p) => (
                  <span
                    key={p}
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      provider === p &&
                        "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
                    )}
                  >
                    {WEATHER_PROVIDER_META[p].label}
                  </span>
                ))}
              </div>

              <div className="divide-y">
                {week.map((row, i) => {
                  const base = row.wx["open-meteo"];
                  return (
                    <div
                      key={i}
                      className="grid items-center gap-2 py-2"
                      style={{
                        gridTemplateColumns: `6rem repeat(${available.length}, minmax(0,1fr))`,
                      }}
                    >
                      <span className="text-xs font-medium capitalize">
                        {i === 0
                          ? "Сьогодні"
                          : format(row.day, "EEE, d MMM", { locale: uk })}
                      </span>
                      {available.map((p) => {
                        const w = row.wx[p] ?? null;
                        const diff =
                          p !== "open-meteo" &&
                          base?.code != null &&
                          w?.code != null &&
                          weatherMeta(base.code).label !==
                            weatherMeta(w.code).label;
                        return <ProviderCell key={p} w={w} highlight={diff} />;
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 px-4 py-4">
          <h2 className="text-base font-medium">Точність прогнозу</h2>
          <p className="text-xs text-muted-foreground">
            Щодня логуємо прогноз кожного провайдера й звіряємо з фактом (аналіз
            Open-Meteo). Дані накопичуються — звірка точніша з часом.
          </p>

          {scores == null ? (
            <p className="text-sm text-muted-foreground">Завантаження…</p>
          ) : scores.every((s) => s.n === 0) ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Ще збираємо дані. Звірка зʼявиться, коли мине кілька залогованих
              днів (зайдіть на цю сторінку протягом наступних днів).
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_5rem_5rem_3rem] items-center gap-2 border-b pb-1 text-xs font-medium text-muted-foreground">
                <span>Провайдер</span>
                <span className="text-right">Похибка t°</span>
                <span className="text-right">Дощ/сухо</span>
                <span className="text-right">Днів</span>
              </div>
              {bestRows(scores).map(({ s, isBest }) => (
                <div
                  key={s.provider}
                  className={cn(
                    "grid grid-cols-[1fr_5rem_5rem_3rem] items-center gap-2 rounded px-1.5 py-1.5 text-sm",
                    isBest && "bg-emerald-50 dark:bg-emerald-950/30"
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    {WEATHER_PROVIDER_META[s.provider].label}
                    {isBest && (
                      <span className="rounded bg-emerald-600 px-1 text-[10px] text-white">
                        точніший
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    {s.maeTemp != null ? `±${s.maeTemp.toFixed(1)}°` : "—"}
                  </span>
                  <span className="text-right tabular-nums">
                    {s.wetAccuracy != null
                      ? `${Math.round(s.wetAccuracy)}%`
                      : "—"}
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {s.n}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

/** Позначити провайдера з найменшою похибкою t° (мін. 2 звірені дні). */
function bestRows(
  scores: ProviderScore[]
): { s: ProviderScore; isBest: boolean }[] {
  const eligible = scores.filter((s) => s.maeTemp != null && s.n >= 2);
  const best =
    eligible.length > 1
      ? eligible.reduce((a, b) => (a.maeTemp! <= b.maeTemp! ? a : b)).provider
      : null;
  return scores.map((s) => ({ s, isBest: s.provider === best }));
}

function ProviderCell({
  w,
  highlight,
}: {
  w: DayWeather | null;
  highlight?: boolean;
}) {
  if (!w?.hasWeather) {
    return <span className="text-xs text-muted-foreground">немає даних</span>;
  }
  const m = weatherMeta(w.code ?? null);
  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-1.5",
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
