/**
 * Логер прогнозів погоди для оцінки точності провайдерів.
 *
 * Ідея: щодня записуємо прогноз КОЖНОГО провайдера на найближчі дні, а коли
 * день настає — фіксуємо «факт» (аналіз Open-Meteo з past_days, що асимілює
 * реальні спостереження). Через кілька днів рахуємо середню похибку t° та
 * влучність «дощ/сухо» для кожного провайдера.
 *
 * Doc id = "YYYY-MM-DD" (дата, на яку прогноз). Колекція weatherLog (admin-only).
 */

import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import {
  dayKey,
  fetchDayWeather,
  DEFAULT_LOCATION,
  type WeatherProvider,
} from "@/lib/utils/weather";

/** Запис прогнозу одного провайдера (зроблений із певним випередженням). */
export interface ForecastEntry {
  tempMax: number | null;
  precipProb: number | null;
  code: number | null;
  /** Випередження в днях (скільки днів до цільової дати на момент запису). */
  lead: number;
}

/** Фактична погода дня (еталон). */
export interface ActualEntry {
  tempMax: number | null;
  code: number | null;
  /** Джерело факту (зараз — аналіз Open-Meteo). */
  source: string;
}

export interface WeatherLogDoc {
  date: string;
  fc?: Partial<Record<WeatherProvider, ForecastEntry>>;
  actual?: ActualEntry;
}

const COL = "weatherLog";
const THROTTLE_KEY = "lavanda.wxLogDay";
const HORIZON_DAYS = 5; // на скільки днів уперед логуємо прогноз
const ACTUAL_PAST_DAYS = 7; // за скільки минулих днів тягнемо факт

function logRef(date: string) {
  return doc(firebase.db, COL, date);
}

function diffDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Фактичні денні дані з Open-Meteo (past_days) → Map(dateKey → ActualEntry). */
async function fetchActuals(): Promise<Map<string, ActualEntry>> {
  const m = new Map<string, ActualEntry>();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LOCATION.lat}` +
    `&longitude=${DEFAULT_LOCATION.lon}` +
    `&daily=temperature_2m_max,weather_code` +
    `&timezone=auto&past_days=${ACTUAL_PAST_DAYS}&forecast_days=1`;
  try {
    const r = await fetch(url);
    if (!r.ok) return m;
    const j = await r.json();
    const t: string[] = j?.daily?.time ?? [];
    t.forEach((ds, i) => {
      m.set(ds, {
        tempMax: j.daily.temperature_2m_max?.[i] ?? null,
        code: j.daily.weather_code?.[i] ?? null,
        source: "open-meteo-analysis",
      });
    });
  } catch (e) {
    console.warn("[weatherLog] fetchActuals failed", e);
  }
  return m;
}

/**
 * Записати прогнози обох провайдерів на горизонт + факти за минулі дні.
 * Тротлиться localStorage: не частіше разу на добу на цьому пристрої.
 * Безпечно ловить помилки (не валить UI).
 */
export async function logWeatherForecasts(providers: WeatherProvider[]): Promise<void> {
  if (typeof window === "undefined") return;
  const today = new Date();
  const todayKey = dayKey(today);
  if (window.localStorage.getItem(THROTTLE_KEY) === todayKey) return;
  // Ставимо мітку одразу, щоб паралельні монтування не дублювали роботу.
  window.localStorage.setItem(THROTTLE_KEY, todayKey);

  try {
    // 1) Прогнози на сьогодні..+HORIZON для кожного провайдера.
    for (let off = 0; off <= HORIZON_DAYS; off++) {
      const target = new Date(today);
      target.setDate(target.getDate() + off);
      const tKey = dayKey(target);
      const lead = off;

      const entries: Partial<Record<WeatherProvider, ForecastEntry>> = {};
      for (const p of providers) {
        const w = await fetchDayWeather(target, DEFAULT_LOCATION, p);
        if (w?.hasWeather) {
          entries[p] = {
            tempMax: w.tempMax,
            precipProb: w.precipProb,
            code: w.code,
            lead,
          };
        }
      }
      if (Object.keys(entries).length === 0) continue;

      // Зберігаємо лише ПЕРШИЙ запис для провайдера (максимальне випередження),
      // щоб метрика відбивала прогноз-наперед, а не майже-факт.
      const snap = await getDoc(logRef(tKey));
      const existing = (snap.exists() ? snap.data() : {}) as WeatherLogDoc;
      const merged: Partial<Record<WeatherProvider, ForecastEntry>> = {
        ...(existing.fc ?? {}),
      };
      let changed = false;
      for (const p of providers) {
        if (entries[p] && !merged[p]) {
          merged[p] = entries[p];
          changed = true;
        }
      }
      if (changed) {
        await setDoc(logRef(tKey), { date: tKey, fc: merged }, { merge: true });
      }
    }

    // 2) Факт за минулі дні (де ще не зафіксовано).
    const actuals = await fetchActuals();
    for (const [dKey, actual] of actuals) {
      if (diffDays(new Date(dKey), today) <= 0) continue; // тільки минулі дні
      const snap = await getDoc(logRef(dKey));
      const existing = (snap.exists() ? snap.data() : null) as WeatherLogDoc | null;
      if (existing?.actual) continue; // факт уже є
      if (!existing?.fc) continue; // не було прогнозу — нема що звіряти
      await setDoc(logRef(dKey), { date: dKey, actual }, { merge: true });
    }
  } catch (e) {
    console.warn("[weatherLog] logWeatherForecasts failed", e);
    // Дозволяємо ретрай у наступній сесії.
    window.localStorage.removeItem(THROTTLE_KEY);
  }
}

/** Завантажити логи, де вже є факт (для звіту точності). Колекція мала (1/день). */
export async function loadScoredLog(): Promise<WeatherLogDoc[]> {
  try {
    const snap = await getDocs(collection(firebase.db, COL));
    return snap.docs
      .map((d) => d.data() as WeatherLogDoc)
      .filter((d) => d.actual && d.fc)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.warn("[weatherLog] loadScoredLog failed", e);
    return [];
  }
}

export interface ProviderScore {
  provider: WeatherProvider;
  /** К-сть звірених днів. */
  n: number;
  /** Середня абсолютна похибка t°, °C. */
  maeTemp: number | null;
  /** Влучність «дощ/сухо», % (0..100). */
  wetAccuracy: number | null;
}

/** Порахувати точність кожного провайдера за логами з фактом. */
export function scoreLog(
  docs: WeatherLogDoc[],
  providers: WeatherProvider[]
): ProviderScore[] {
  return providers.map((p) => {
    let tempErrSum = 0;
    let tempN = 0;
    let wetHit = 0;
    let wetN = 0;
    for (const d of docs) {
      const fc = d.fc?.[p];
      const ac = d.actual;
      if (!fc || !ac) continue;
      if (fc.tempMax != null && ac.tempMax != null) {
        tempErrSum += Math.abs(fc.tempMax - ac.tempMax);
        tempN++;
      }
      // «Дощ» прогнозу: ймовірність опадів ≥ 50%. «Дощ» факту: code ≥ 51.
      if (fc.precipProb != null && ac.code != null) {
        const fcWet = fc.precipProb >= 50;
        const acWet = ac.code >= 51;
        if (fcWet === acWet) wetHit++;
        wetN++;
      }
    }
    return {
      provider: p,
      n: Math.max(tempN, wetN),
      maeTemp: tempN ? tempErrSum / tempN : null,
      wetAccuracy: wetN ? (wetHit / wetN) * 100 : null,
    };
  });
}
