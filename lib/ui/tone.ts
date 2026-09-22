/**
 * Кольорові тони інтерфейсу — в одному місці.
 *
 * До цього кольори статусів жили окремо в кожному екрані й розходились:
 * у Замовленнях бейдж був `bg-*-100 text-*-700`, у Фотосесіях —
 * `bg-*-100 text-*-900 border-*-300`. Один і той самий «підтверджено»
 * виглядав по-різному на сусідніх сторінках.
 *
 * Тут лише структура (яка роль який відтінок бере). Самі значення й далі
 * з палітри Tailwind: переводити всі 400 утиліт на токени немає сенсу —
 * вони не змінюються від теми, на відміну від бренду й сум, які винесені
 * в `--brand` / `--income` / `--expense`.
 */

export type Tone = "sky" | "violet" | "amber" | "teal" | "emerald" | "zinc";

/** Бейдж статусу: м'яка підкладка, текст -800 (≥4.5:1 на ній). */
export const TONE_BADGE: Record<Tone, string> = {
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

/** Той самий бейдж, але з рамкою — для щільних списків (таймлайн). */
export const TONE_BADGE_BORDERED: Record<Tone, string> = {
  sky: `${TONE_BADGE.sky} border border-sky-300 dark:border-sky-800`,
  violet: `${TONE_BADGE.violet} border border-violet-300 dark:border-violet-800`,
  amber: `${TONE_BADGE.amber} border border-amber-300 dark:border-amber-800`,
  teal: `${TONE_BADGE.teal} border border-teal-300 dark:border-teal-800`,
  emerald: `${TONE_BADGE.emerald} border border-emerald-300 dark:border-emerald-800`,
  zinc: `${TONE_BADGE.zinc} border border-zinc-300 dark:border-zinc-700`,
};

/** Кольорова крапка того ж тону. */
export const TONE_DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  emerald: "bg-emerald-500",
  zinc: "bg-zinc-400",
};

/** Суми: беруть токени, бо мають різні значення у світлій і темній темі. */
export const MONEY_TONE = {
  income: "text-income",
  expense: "text-expense",
  net: "text-net",
} as const;
