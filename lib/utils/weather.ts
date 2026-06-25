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

// ── Провайдери погоди ───────────────────────────────────────────────────────
// Open-Meteo — основний (без ключа, +схід/захід). OpenWeatherMap — другий, для
// порівняння прогнозу (потрібен ключ NEXT_PUBLIC_OPENWEATHER_KEY, free 5д/3год).
export type WeatherProvider = "open-meteo" | "openweathermap" | "metno";

export const WEATHER_PROVIDER_META: Record<
  WeatherProvider,
  { label: string; short: string }
> = {
  "open-meteo": { label: "Open-Meteo", short: "OM" },
  openweathermap: { label: "OpenWeatherMap", short: "OWM" },
  metno: { label: "Met.no (yr.no)", short: "MET" },
};

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? "";

// Met.no тягнемо через бекенд-проксі invest-notify (у браузері Met.no без CORS
// і блокує браузерний User-Agent). Той самий API base/key, що й для Telegram.
const NOTIFY_BASE = (process.env.NEXT_PUBLIC_NOTIFY_API_BASE ?? "").replace(/\/$/, "");
const NOTIFY_KEY = process.env.NEXT_PUBLIC_NOTIFY_API_KEY ?? "";

/** Чи налаштований OpenWeatherMap (є ключ). */
export function owmConfigured(): boolean {
  return OWM_KEY !== "";
}

/** Чи доступний Met.no (налаштований бекенд-проксі). */
export function metnoConfigured(): boolean {
  return NOTIFY_BASE !== "" && NOTIFY_KEY !== "";
}

const PROVIDER_LS_KEY = "lavanda.weatherProvider";
const providerListeners = new Set<() => void>();

/** Активний провайдер (з localStorage; default Open-Meteo). */
export function getWeatherProvider(): WeatherProvider {
  if (typeof window === "undefined") return "open-meteo";
  const v = window.localStorage.getItem(PROVIDER_LS_KEY);
  // OpenWeatherMap прибрано зі списку (неточний прогноз) — лишаємо лише на
  // випадок ручного логування/порівняння, але як активний не пропонуємо.
  if (v === "metno" && metnoConfigured()) return "metno";
  return "open-meteo";
}

/** Змінити активний провайдер (сповіщає всі хуки). */
export function setWeatherProvider(p: WeatherProvider): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROVIDER_LS_KEY, p);
  }
  providerListeners.forEach((f) => f());
}

/** Хук: активний провайдер + сеттер. Реагує на зміни в інших компонентах. */
export function useWeatherProvider(): [
  WeatherProvider,
  (p: WeatherProvider) => void,
] {
  // Старт із default, щоб уникнути hydration mismatch; синхронізуємо в ефекті.
  const [p, setP] = useState<WeatherProvider>("open-meteo");
  useEffect(() => {
    const sync = () => setP(getWeatherProvider());
    sync();
    providerListeners.add(sync);
    return () => {
      providerListeners.delete(sync);
    };
  }, []);
  return [p, setWeatherProvider];
}

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

// Кеш по ключу дати+локації+провайдера, щоб не смикати API повторно в сесії.
const cache = new Map<string, Promise<DayWeather | null>>();

export function fetchDayWeather(
  day: Date,
  loc = DEFAULT_LOCATION,
  provider: WeatherProvider = getWeatherProvider()
): Promise<DayWeather | null> {
  const key = dayKey(day);
  const cacheKey = `${provider}|${key}@${loc.lat},${loc.lon}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const p =
    provider === "openweathermap"
      ? fetchDayOwm(day, loc)
      : provider === "metno"
        ? fetchDayMetno(day, loc)
        : fetchDayOpenMeteo(day, loc);
  cache.set(cacheKey, p);
  return p;
}

function fetchDayOpenMeteo(
  day: Date,
  loc: typeof DEFAULT_LOCATION
): Promise<DayWeather | null> {
  const key = dayKey(day);

  // Поза вікном прогнозу — не смикаємо API (інакше 400). Даних нема.
  if (!inForecast(day)) {
    return Promise.resolve<DayWeather | null>(null);
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}` +
    `&longitude=${loc.lon}` +
    `&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunshine_duration,daylight_duration` +
    `&hourly=temperature_2m,weather_code,cloud_cover,precipitation_probability,precipitation` +
    `&timezone=auto&start_date=${key}&end_date=${key}`;

  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j): DayWeather => {
      const d = j?.daily ?? {};
      const sunrise = parseLocal(d.sunrise?.[0]);
      const sunset = parseLocal(d.sunset?.[0]);
      const tempMax = d.temperature_2m_max?.[0] ?? null;
      // Денний weather_code «песимістичний» (найгірша година). Для сухих днів
      // пом'якшуємо за часткою сонячного сяйва (як monthDayEmoji), щоб не було
      // «Хмарно» при +40°. Опади/туман/гроза (≥45) лишаємо за кодом.
      const code = softenDayCode(
        d.weather_code?.[0] ?? null,
        d.sunshine_duration?.[0] ?? null,
        d.daylight_duration?.[0] ?? null
      );

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
      console.warn("fetchDayOpenMeteo failed", e);
      return null;
    });

  return p;
}

// ── OpenWeatherMap (другий провайдер) ───────────────────────────────────────
// Free tier: /data/2.5/forecast — 5 днів / крок 3 год, час у UTC + city.timezone
// (offset, с). Схід/захід беремо з Open-Meteo (астрономічні, для будь-якої дати).

/** OWM condition id → наближений WMO weather code (щоб перевикористати weatherMeta). */
function owmIdToWmo(id: number): number {
  if (id >= 200 && id < 300) return 95; // гроза
  if (id >= 300 && id < 400) return 53; // мряка
  if (id >= 500 && id < 600) {
    if (id === 500) return 61;
    if (id === 501) return 63;
    if (id <= 504) return 65;
    if (id === 511) return 66; // льодяний дощ
    if (id >= 520) return 81; // зливи
    return 63;
  }
  if (id >= 600 && id < 700) {
    if (id <= 601) return 73;
    if (id === 602) return 75;
    if (id >= 611 && id <= 616) return 66; // мокрий сніг
    return 85; // снігові заряди
  }
  if (id >= 700 && id < 800) return 45; // туман/імла
  if (id === 800) return 0; // ясно
  if (id === 801) return 1;
  if (id === 802) return 2;
  return 3; // 803/804 — хмарно
}

interface OwmForecast {
  list: OwmItem[];
  tz: number; // offset, с
}
interface OwmItem {
  dt: number;
  main?: { temp?: number };
  weather?: { id?: number }[];
  clouds?: { all?: number };
  pop?: number;
  rain?: { "3h"?: number };
  snow?: { "3h"?: number };
}

// Один виклик forecast покриває всі 5 днів → кеш по локації.
const owmCache = new Map<string, Promise<OwmForecast | null>>();

function fetchOwmForecast(loc: typeof DEFAULT_LOCATION): Promise<OwmForecast | null> {
  const ck = `${loc.lat},${loc.lon}`;
  const hit = owmCache.get(ck);
  if (hit) return hit;
  if (!OWM_KEY) {
    const p = Promise.resolve<OwmForecast | null>(null);
    owmCache.set(ck, p);
    return p;
  }
  const url =
    `https://api.openweathermap.org/data/2.5/forecast?lat=${loc.lat}` +
    `&lon=${loc.lon}&units=metric&lang=ua&appid=${OWM_KEY}`;
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(
      (j): OwmForecast => ({
        list: (j?.list ?? []) as OwmItem[],
        tz: j?.city?.timezone ?? 0,
      })
    )
    .catch((e) => {
      console.warn("fetchOwmForecast failed", e);
      owmCache.delete(ck);
      return null;
    });
  owmCache.set(ck, p);
  return p;
}

/** Локальний час OWM-елемента (dt у UTC + offset зони). Читати через getUTC*. */
function owmLocal(it: OwmItem, tz: number): Date {
  return new Date((it.dt + tz) * 1000);
}
function owmKey(it: OwmItem, tz: number): string {
  const d = owmLocal(it, tz);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Схід/захід завжди з Open-Meteo (астрономічні, надійні поза вікном OWM).
const sunCache = new Map<string, Promise<{ sunrise: Date | null; sunset: Date | null } | null>>();
function fetchSun(
  day: Date,
  loc: typeof DEFAULT_LOCATION
): Promise<{ sunrise: Date | null; sunset: Date | null } | null> {
  const key = dayKey(day);
  const ck = `${key}@${loc.lat},${loc.lon}`;
  const hit = sunCache.get(ck);
  if (hit) return hit;
  if (!inForecast(day)) {
    const p = Promise.resolve(null);
    sunCache.set(ck, p);
    return p;
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}` +
    `&longitude=${loc.lon}&daily=sunrise,sunset&timezone=auto` +
    `&start_date=${key}&end_date=${key}`;
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => ({
      sunrise: parseLocal(j?.daily?.sunrise?.[0]),
      sunset: parseLocal(j?.daily?.sunset?.[0]),
    }))
    .catch((e) => {
      console.warn("fetchSun failed", e);
      sunCache.delete(ck);
      return null;
    });
  sunCache.set(ck, p);
  return p;
}

async function fetchDayOwm(
  day: Date,
  loc: typeof DEFAULT_LOCATION
): Promise<DayWeather | null> {
  const key = dayKey(day);
  const [sun, owm] = await Promise.all([fetchSun(day, loc), fetchOwmForecast(loc)]);
  const sunrise = sun?.sunrise ?? null;
  const sunset = sun?.sunset ?? null;
  const goldenAm: [Date, Date] | null = sunrise
    ? [sunrise, new Date(sunrise.getTime() + GOLDEN_MIN * 60000)]
    : null;
  const goldenPm: [Date, Date] | null = sunset
    ? [new Date(sunset.getTime() - GOLDEN_MIN * 60000), sunset]
    : null;

  const tz = owm?.tz ?? 0;
  const items = (owm?.list ?? []).filter((it) => owmKey(it, tz) === key);
  const hourly: HourWeather[] = items.map((it) => {
    const d = owmLocal(it, tz);
    return {
      hour: d.getUTCHours(),
      temp: it.main?.temp ?? null,
      code: owmIdToWmo(it.weather?.[0]?.id ?? 800),
      cloud: it.clouds?.all ?? null,
      precipProb: it.pop != null ? Math.round(it.pop * 100) : null,
      precip: it.rain?.["3h"] ?? it.snow?.["3h"] ?? 0,
    };
  });

  const temps = items.map((i) => i.main?.temp).filter((n): n is number => n != null);
  const codes = hourly.map((h) => h.code).filter((c): c is number => c != null);
  const pops = items.map((i) => i.pop ?? 0);
  return {
    key,
    sunrise,
    sunset,
    hourly,
    goldenAm,
    goldenPm,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : null,
    tempMin: temps.length ? Math.round(Math.min(...temps)) : null,
    code: codes.length ? Math.max(...codes) : null, // песимістичний, як в Open-Meteo
    precipProb: pops.length ? Math.round(Math.max(...pops) * 100) : null,
    hasWeather: hourly.length > 0,
  };
}

// ── Met.no (через бекенд-проксі) ────────────────────────────────────────────
// Бекенд віддає погодинний прогноз: time (локальний ISO), temp, cloud, code
// (WMO), precip. Схід/захід — з Open-Meteo (астрономічні).
interface MetnoHour {
  time: string;
  temp: number | null;
  cloud: number | null;
  code: number | null;
  precip: number | null;
}

const metnoCache = new Map<string, Promise<MetnoHour[] | null>>();

function fetchMetnoForecast(loc: typeof DEFAULT_LOCATION): Promise<MetnoHour[] | null> {
  const ck = `${loc.lat},${loc.lon}`;
  const hit = metnoCache.get(ck);
  if (hit) return hit;
  if (!metnoConfigured()) {
    const p = Promise.resolve<MetnoHour[] | null>(null);
    metnoCache.set(ck, p);
    return p;
  }
  const url = `${NOTIFY_BASE}/lavanda/weather/metno?lat=${loc.lat}&lon=${loc.lon}`;
  const p = fetch(url, { headers: { "X-API-Key": NOTIFY_KEY } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => (j?.ok ? (j.hours as MetnoHour[]) : null))
    .catch((e) => {
      console.warn("fetchMetnoForecast failed", e);
      metnoCache.delete(ck);
      return null;
    });
  metnoCache.set(ck, p);
  return p;
}

// Met.no не дає ймовірності опадів — синтезуємо «мокро» з коду (≥51).
const metnoPrecipProb = (code: number | null) =>
  code != null && code >= 51 ? 100 : 0;

async function fetchDayMetno(
  day: Date,
  loc: typeof DEFAULT_LOCATION
): Promise<DayWeather | null> {
  const key = dayKey(day);
  const [sun, hours] = await Promise.all([fetchSun(day, loc), fetchMetnoForecast(loc)]);
  const sunrise = sun?.sunrise ?? null;
  const sunset = sun?.sunset ?? null;
  const goldenAm: [Date, Date] | null = sunrise
    ? [sunrise, new Date(sunrise.getTime() + GOLDEN_MIN * 60000)]
    : null;
  const goldenPm: [Date, Date] | null = sunset
    ? [new Date(sunset.getTime() - GOLDEN_MIN * 60000), sunset]
    : null;

  const items = (hours ?? []).filter((h) => {
    const d = parseLocal(h.time);
    return d != null && dayKey(d) === key;
  });
  const hourly: HourWeather[] = items.map((h) => {
    const d = parseLocal(h.time)!;
    return {
      hour: d.getHours(),
      temp: h.temp,
      code: h.code,
      cloud: h.cloud,
      precipProb: metnoPrecipProb(h.code),
      precip: h.precip ?? 0,
    };
  });
  const temps = items.map((h) => h.temp).filter((n): n is number => n != null);
  const codes = hourly.map((h) => h.code).filter((c): c is number => c != null);
  const code = codes.length ? Math.max(...codes) : null;
  return {
    key,
    sunrise,
    sunset,
    hourly,
    goldenAm,
    goldenPm,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : null,
    tempMin: temps.length ? Math.round(Math.min(...temps)) : null,
    code,
    precipProb: code != null ? metnoPrecipProb(code) : null,
    hasWeather: hourly.length > 0,
  };
}

async function fetchMonthMetno(
  year: number,
  month0: number,
  loc: typeof DEFAULT_LOCATION
): Promise<Map<number, MonthDayWx>> {
  const hours = await fetchMetnoForecast(loc);
  const m = new Map<number, MonthDayWx>();
  if (!hours) return m;
  const byDay = new Map<number, { hour: number; code: number; wet: boolean }[]>();
  for (const h of hours) {
    const d = parseLocal(h.time);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month0) continue;
    const day = d.getDate();
    const arr = byDay.get(day) ?? [];
    arr.push({ hour: d.getHours(), code: h.code ?? 3, wet: (h.code ?? 0) >= 51 });
    byDay.set(day, arr);
  }
  for (const [day, arr] of byDay) {
    const noon = arr.reduce((a, b) =>
      Math.abs(b.hour - 12) < Math.abs(a.hour - 12) ? b : a
    );
    m.set(day, {
      code: noon.code,
      precipProb: arr.some((x) => x.wet) ? 100 : 0,
      sunshine: null,
      daylight: null,
    });
  }
  return m;
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
  loc = DEFAULT_LOCATION,
  provider: WeatherProvider = getWeatherProvider()
): Promise<Map<number, MonthDayWx>> {
  const mk = `${year}-${month0}`;
  const key = `${provider}|${mk}@${loc.lat},${loc.lon}`;
  const hit = monthCache.get(key);
  if (hit) return hit;

  if (provider === "openweathermap") {
    const p = fetchMonthOwm(year, month0, loc);
    monthCache.set(key, p);
    return p;
  }
  if (provider === "metno") {
    const p = fetchMonthMetno(year, month0, loc);
    monthCache.set(key, p);
    return p;
  }

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

/** OWM-версія місячного прогнозу (тільки ~5 днів уперед; решта днів без даних). */
async function fetchMonthOwm(
  year: number,
  month0: number,
  loc: typeof DEFAULT_LOCATION
): Promise<Map<number, MonthDayWx>> {
  const owm = await fetchOwmForecast(loc);
  const m = new Map<number, MonthDayWx>();
  if (!owm) return m;
  // День → елементи (для коду беремо найближчий до 12:00, опади — макс pop).
  const byDay = new Map<number, { hour: number; code: number; pop: number }[]>();
  for (const it of owm.list) {
    const d = owmLocal(it, owm.tz);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month0) continue;
    const day = d.getUTCDate();
    const arr = byDay.get(day) ?? [];
    arr.push({
      hour: d.getUTCHours(),
      code: owmIdToWmo(it.weather?.[0]?.id ?? 800),
      pop: it.pop ?? 0,
    });
    byDay.set(day, arr);
  }
  for (const [day, arr] of byDay) {
    const noon = arr.reduce((a, b) =>
      Math.abs(b.hour - 12) < Math.abs(a.hour - 12) ? b : a
    );
    m.set(day, {
      code: noon.code,
      precipProb: Math.round(Math.max(...arr.map((x) => x.pop)) * 100),
      sunshine: null,
      daylight: null,
    });
  }
  return m;
}

/** Хук: погода на місяць для міні-календаря. */
export function useMonthWeather(
  year: number,
  month0: number,
  loc = DEFAULT_LOCATION
) {
  const [provider] = useWeatherProvider();
  const [map, setMap] = useState<Map<number, MonthDayWx>>(new Map());
  const key = `${provider}|${year}-${month0}`;
  useEffect(() => {
    let alive = true;
    fetchMonthWeather(year, month0, loc, provider).then((m) => {
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
  return weatherMeta(softenDayCode(wx.code, wx.sunshine, wx.daylight)).emoji;
}

/**
 * Пом'якшити денний weather_code для сухих днів за часткою сонячного сяйва.
 * Опади/туман/гроза (code ≥ 45) лишаються; ясні дні отримують 0/2/3 за ratio.
 */
export function softenDayCode(
  code: number | null,
  sunshine: number | null,
  daylight: number | null
): number | null {
  if (code != null && code >= 45) return code; // опади/туман/гроза — довіряємо
  if (daylight && daylight > 0 && sunshine != null) {
    const r = sunshine / daylight;
    if (r >= 0.6) return 0; // ☀️ ясно
    if (r >= 0.3) return 2; // ⛅ мінлива хмарність
    return 3; // ☁️ хмарно
  }
  return code;
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
  const [provider] = useWeatherProvider();
  const key = `${provider}|${dayKey(day)}`;
  // Тримаємо результат разом із його ключем — loading похідний (без
  // синхронного setState в ефекті), доки результат не співпаде з поточним днем.
  const [state, setState] = useState<{ key: string; weather: DayWeather | null }>(
    { key: "", weather: null }
  );

  useEffect(() => {
    let alive = true;
    fetchDayWeather(day, loc, provider).then((w) => {
      if (alive) setState({ key, weather: w });
    });
    return () => {
      alive = false;
    };
    // day+provider сериалізуємо через key; loc — стала константа.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = state.key === key;
  return { weather: ready ? state.weather : null, loading: !ready };
}
