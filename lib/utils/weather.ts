// Погода + схід/захід/золота година для календаря фотосесій.
// Джерело: Open-Meteo (безкоштовно, без ключа). Прогноз ~16 днів вперед і
// кілька місяців назад; схід/захід рахуються астрономічно для будь-якої дати.

import { useEffect, useState } from "react";

// Локація за замовчуванням — Kvita, лавандова фотолокація (Павлівка, Вінницька обл.).
// Сонце сходить зі сходу → ранок освітлює східну сторону поля («Східна сторона»),
// вечір — західну («Західна сторона»); це враховано в назвах фаз/слотів.
export const DEFAULT_LOCATION = {
  lat: 49.4390326,
  lon: 28.4773452,
  label: "Kvita, Павлівка",
};

export interface HourWeather {
  /** Локальна година 0..23. */
  hour: number;
  temp: number | null;
  code: number | null;
  /** Хмарність, %. */
  cloud: number | null;
  /** Імовірність опадів, %. */
  precipProb: number | null;
  /** Опади, мм. */
  precip: number | null;
}

export interface DayWeather {
  /** "YYYY-MM-DD" локальної дати. */
  key: string;
  sunrise: Date | null;
  sunset: Date | null;
  /** Погодинний прогноз (порожньо, якщо поза вікном прогнозу). */
  hourly: HourWeather[];
  /** Ранкова золота година [початок, кінець] (≈ схід … схід+1год). */
  goldenAm: [Date, Date] | null;
  /** Вечірня золота година [початок, кінець] (≈ захід−1год … захід). */
  goldenPm: [Date, Date] | null;
  tempMax: number | null;
  tempMin: number | null;
  /** WMO weather code. */
  code: number | null;
  /** Імовірність опадів, %. */
  precipProb: number | null;
  /** Чи є дані погоди (поза вікном прогнозу лишаються тільки схід/захід). */
  hasWeather: boolean;
}

const GOLDEN_MIN = 60; // тривалість золотої години, хв

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Локальний ключ дати "YYYY-MM-DD" (не UTC). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const fmtDate = dayKey;

/** Вікно прогнозу Open-Meteo: приблизно −90…+15 днів від сьогодні. */
function forecastRange(): { min: Date; max: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  min.setDate(min.getDate() - 90);
  const max = new Date(today);
  max.setDate(max.getDate() + 15);
  return { min, max };
}

/** Чи дата в межах прогнозу. */
function inForecast(d: Date): boolean {
  const { min, max } = forecastRange();
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x >= min && x <= max;
}

// Open-Meteo із timezone=auto повертає час як "2026-06-25T05:12" (локальний,
// без зони). new Date() трактує його як локальний — саме те, що треба.
function parseLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Кеш по ключу дати+локації, щоб не смикати API повторно в одній сесії.
const cache = new Map<string, Promise<DayWeather | null>>();

export function fetchDayWeather(
  day: Date,
  loc = DEFAULT_LOCATION
): Promise<DayWeather | null> {
  const key = dayKey(day);
  const cacheKey = `${key}@${loc.lat},${loc.lon}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  // Поза вікном прогнозу — не смикаємо API (інакше 400). Даних нема.
  if (!inForecast(day)) {
    const p = Promise.resolve<DayWeather | null>(null);
    cache.set(cacheKey, p);
    return p;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}` +
    `&longitude=${loc.lon}` +
    `&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
    `&hourly=temperature_2m,weather_code,cloud_cover,precipitation_probability,precipitation` +
    `&timezone=auto&start_date=${key}&end_date=${key}`;

  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j): DayWeather => {
      const d = j?.daily ?? {};
      const sunrise = parseLocal(d.sunrise?.[0]);
      const sunset = parseLocal(d.sunset?.[0]);
      const tempMax = d.temperature_2m_max?.[0] ?? null;
      const code = d.weather_code?.[0] ?? null;

      const goldenAm: [Date, Date] | null = sunrise
        ? [sunrise, new Date(sunrise.getTime() + GOLDEN_MIN * 60000)]
        : null;
      const goldenPm: [Date, Date] | null = sunset
        ? [new Date(sunset.getTime() - GOLDEN_MIN * 60000), sunset]
        : null;

      const h = j?.hourly ?? {};
      const times: string[] = h.time ?? [];
      const hourly: HourWeather[] = times.map((t, i) => {
        const d = parseLocal(t);
        return {
          hour: d ? d.getHours() : i,
          temp: h.temperature_2m?.[i] ?? null,
          code: h.weather_code?.[i] ?? null,
          cloud: h.cloud_cover?.[i] ?? null,
          precipProb: h.precipitation_probability?.[i] ?? null,
          precip: h.precipitation?.[i] ?? null,
        };
      });

      return {
        key,
        sunrise,
        sunset,
        hourly,
        goldenAm,
        goldenPm,
        tempMax,
        tempMin: d.temperature_2m_min?.[0] ?? null,
        code,
        precipProb: d.precipitation_probability_max?.[0] ?? null,
        hasWeather: tempMax != null || code != null,
      };
    })
    .catch((e) => {
      console.warn("fetchDayWeather failed", e);
      cache.delete(cacheKey); // дати шанс ретраю при наступному запиті
      return null;
    });

  cache.set(cacheKey, p);
  return p;
}

// ── Погода на місяць (для позначок у міні-календарі) ────────────────────────
export interface MonthDayWx {
  code: number | null;
  precipProb: number | null;
  /** Тривалість сонячного сяйва, с. */
  sunshine: number | null;
  /** Тривалість світлового дня, с. */
  daylight: number | null;
}

const monthCache = new Map<string, Promise<Map<number, MonthDayWx>>>();

/** Денний прогноз на весь місяць → Map(день → {code, precipProb}). */
export function fetchMonthWeather(
  year: number,
  month0: number,
  loc = DEFAULT_LOCATION
): Promise<Map<number, MonthDayWx>> {
  const mk = `${year}-${month0}`;
  const key = `${mk}@${loc.lat},${loc.lon}`;
  const hit = monthCache.get(key);
  if (hit) return hit;

  // Open-Meteo forecast дає ~−90…+15 днів. Клампимо діапазон місяця у це вікно,
  // інакше API повертає 400 (out of allowed range).
  const { min, max } = forecastRange();
  const monthStart = new Date(year, month0, 1);
  const monthEnd = new Date(year, month0 + 1, 0);
  const s = monthStart < min ? min : monthStart;
  const e = monthEnd > max ? max : monthEnd;
  if (s > e) {
    // Місяць повністю поза вікном прогнозу — даних нема.
    const empty = Promise.resolve(new Map<number, MonthDayWx>());
    monthCache.set(key, empty);
    return empty;
  }
  const start = fmtDate(s);
  const end = fmtDate(e);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}` +
    `&longitude=${loc.lon}` +
    `&daily=weather_code,precipitation_probability_max,sunshine_duration,daylight_duration` +
    `&timezone=auto&start_date=${start}&end_date=${end}`;

  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => {
      const m = new Map<number, MonthDayWx>();
      const t: string[] = j?.daily?.time ?? [];
      t.forEach((ds, i) => {
        const day = Number(ds.slice(8, 10));
        m.set(day, {
          code: j.daily.weather_code?.[i] ?? null,
          precipProb: j.daily.precipitation_probability_max?.[i] ?? null,
          sunshine: j.daily.sunshine_duration?.[i] ?? null,
          daylight: j.daily.daylight_duration?.[i] ?? null,
        });
      });
      return m;
    })
    .catch((e) => {
      console.warn("fetchMonthWeather failed", e);
      monthCache.delete(key);
      return new Map<number, MonthDayWx>();
    });

  monthCache.set(key, p);
  return p;
}

/** Хук: погода на місяць для міні-календаря. */
export function useMonthWeather(
  year: number,
  month0: number,
  loc = DEFAULT_LOCATION
) {
  const [map, setMap] = useState<Map<number, MonthDayWx>>(new Map());
  const key = `${year}-${month0}`;
  useEffect(() => {
    let alive = true;
    fetchMonthWeather(year, month0, loc).then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

/** Погана погода для зйомки: мряка/дощ/сніг/гроза (WMO code ≥ 51). */
export function isBadWeather(code: number | null): boolean {
  return code != null && code >= 51;
}

/**
 * Емодзі дня для календаря. Денний weather_code Open-Meteo «песимістичний»
 * (бере найгіршу годину), тож для сухих днів обираємо за часткою сонячного
 * сяйва, а опади/туман лишаємо за кодом.
 */
export function monthDayEmoji(wx: MonthDayWx): string {
  // Опади/туман/гроза — довіряємо коду.
  if (wx.code != null && (wx.code >= 45)) return weatherMeta(wx.code).emoji;
  if (wx.daylight && wx.daylight > 0 && wx.sunshine != null) {
    const r = wx.sunshine / wx.daylight;
    if (r >= 0.6) return "☀️";
    if (r >= 0.3) return "⛅";
    return "☁️";
  }
  return weatherMeta(wx.code ?? null).emoji;
}

// ── Фази освітлення дня (для фото) ──────────────────────────────────────────
export type LightingKey =
  | "idealAm"
  | "goodAm"
  | "neutral"
  | "harsh"
  | "idealPm"
  | "bluePm";

export interface LightingPhase {
  key: LightingKey;
  from: Date;
  to: Date;
}

// band — горизонтальний градієнт смуги; swatch — квадратик у легенді;
// text — колір іконки фази.
export const LIGHTING_META: Record<
  LightingKey,
  { label: string; band: string; swatch: string; text: string }
> = {
  idealAm: {
    label: "Найкраще для фото (схід)",
    band: "bg-gradient-to-r from-violet-200/60 to-violet-100/5 dark:from-violet-500/15 dark:to-transparent",
    swatch: "bg-violet-200 dark:bg-violet-500/50",
    text: "text-violet-600 dark:text-violet-300",
  },
  goodAm: {
    label: "Добре для фото",
    band: "bg-gradient-to-r from-emerald-200/55 to-emerald-100/5 dark:from-emerald-500/15 dark:to-transparent",
    swatch: "bg-emerald-200 dark:bg-emerald-500/50",
    text: "text-emerald-600 dark:text-emerald-300",
  },
  neutral: {
    label: "Нейтрально",
    band: "bg-gradient-to-r from-amber-100/60 to-amber-50/5 dark:from-amber-400/10 dark:to-transparent",
    swatch: "bg-amber-100 dark:bg-amber-400/40",
    text: "text-amber-500 dark:text-amber-300",
  },
  harsh: {
    label: "Жорстке світло",
    band: "bg-gradient-to-r from-orange-200/60 to-orange-100/5 dark:from-orange-500/15 dark:to-transparent",
    swatch: "bg-orange-200 dark:bg-orange-500/40",
    text: "text-orange-500 dark:text-orange-300",
  },
  idealPm: {
    label: "Найкраще для фото (захід)",
    band: "bg-gradient-to-r from-violet-200/60 to-purple-100/5 dark:from-violet-500/15 dark:to-transparent",
    swatch: "bg-violet-300 dark:bg-violet-500/60",
    text: "text-violet-600 dark:text-violet-300",
  },
  bluePm: {
    label: "Blue hour / відео",
    band: "bg-gradient-to-r from-blue-200/55 to-blue-100/5 dark:from-blue-500/15 dark:to-transparent",
    swatch: "bg-blue-200 dark:bg-blue-500/40",
    text: "text-blue-600 dark:text-blue-300",
  },
};

/** Поділ дня на фази освітлення за сходом/заходом (зміщення в годинах). */
export function lightingPhases(sunrise: Date, sunset: Date): LightingPhase[] {
  const add = (base: Date, hours: number) =>
    new Date(base.getTime() + hours * 3600000);
  return [
    { key: "idealAm", from: sunrise, to: add(sunrise, 2.5) },
    { key: "goodAm", from: add(sunrise, 2.5), to: add(sunrise, 5) },
    { key: "neutral", from: add(sunrise, 5), to: add(sunset, -5) },
    { key: "harsh", from: add(sunset, -5), to: add(sunset, -3) },
    { key: "idealPm", from: add(sunset, -3), to: add(sunset, -0.5) },
    { key: "bluePm", from: add(sunset, -0.5), to: add(sunset, 0.5) },
  ];
}

/** Фази для дня з погоди (null, якщо немає сходу/заходу). */
export function phasesFromWeather(w: DayWeather | null): LightingPhase[] | null {
  if (!w?.sunrise || !w?.sunset) return null;
  return lightingPhases(w.sunrise, w.sunset);
}

/** WMO weather code → емодзі + укр. опис. */
export function weatherMeta(code: number | null): { emoji: string; label: string } {
  if (code == null) return { emoji: "❓", label: "—" };
  if (code === 0) return { emoji: "☀️", label: "Ясно" };
  if (code === 1) return { emoji: "🌤️", label: "Переважно ясно" };
  if (code === 2) return { emoji: "⛅", label: "Мінлива хмарність" };
  if (code === 3) return { emoji: "☁️", label: "Хмарно" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Туман" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Мряка" };
  if (code >= 61 && code <= 65) return { emoji: "🌧️", label: "Дощ" };
  if (code === 66 || code === 67) return { emoji: "🌧️", label: "Льодяний дощ" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", label: "Сніг" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "Зливи" };
  if (code === 85 || code === 86) return { emoji: "🌨️", label: "Снігопад" };
  if (code === 95) return { emoji: "⛈️", label: "Гроза" };
  if (code === 96 || code === 99) return { emoji: "⛈️", label: "Гроза з градом" };
  return { emoji: "🌡️", label: "—" };
}

/** Хук: погода обраного дня (з кешем і скасуванням гонок). */
export function useDayWeather(day: Date, loc = DEFAULT_LOCATION) {
  const key = dayKey(day);
  // Тримаємо результат разом із його ключем — loading похідний (без
  // синхронного setState в ефекті), доки результат не співпаде з поточним днем.
  const [state, setState] = useState<{ key: string; weather: DayWeather | null }>(
    { key: "", weather: null }
  );

  useEffect(() => {
    let alive = true;
    fetchDayWeather(day, loc).then((w) => {
      if (alive) setState({ key, weather: w });
    });
    return () => {
      alive = false;
    };
    // day сериалізуємо через key; loc — стала константа.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = state.key === key;
  return { weather: ready ? state.weather : null, loading: !ready };
}
