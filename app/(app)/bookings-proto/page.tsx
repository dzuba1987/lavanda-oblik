"use client";

// ПРОТОТИП: 4 варіанти позначок поганої погоди на міні-календарі.
// Моки: дощ/гроза на кількох днях липня. Прогноз реально ~16 днів уперед.

import { weatherMeta } from "@/lib/utils/weather";

const YEAR = 2026;
const MONTH = 6; // липень (0-based)

// День → {code, prob%}. Погана погода = code >= 51 (мряка/дощ/сніг/гроза).
const WX: Record<number, { code: number; prob: number }> = {
  2: { code: 95, prob: 60 }, // гроза
  3: { code: 61, prob: 70 },
  4: { code: 63, prob: 80 },
  9: { code: 80, prob: 55 },
  10: { code: 51, prob: 40 },
  15: { code: 96, prob: 65 },
  22: { code: 65, prob: 75 },
};
const BUSY = new Set([2, 9, 16, 23]); // дні із записами
const TODAY = 2;

const isBad = (c?: number) => c != null && c >= 51;

function monthCells() {
  const first = new Date(YEAR, MONTH, 1);
  const firstWd = (first.getDay() + 6) % 7; // Пн=0
  const days = new Date(YEAR, MONTH + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWd).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  return cells;
}

export default function BookingsProtoPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Позначки поганої погоди на календарі
        </h1>
        <p className="text-sm text-muted-foreground">
          Дощ/гроза за прогнозом. Фіолетова крапка = є записи.
        </p>
      </header>
      <div className="flex flex-wrap gap-6">
        <Variant title="A · Емодзі в кутику">
          <Mini variant="emoji" />
        </Variant>
        <Variant title="B · Синя крапля">
          <Mini variant="dot" />
        </Variant>
        <Variant title="C · Нижня смужка">
          <Mini variant="bar" />
        </Variant>
        <Variant title="D · Заливка тла">
          <Mini variant="bg" />
        </Variant>
      </div>
    </main>
  );
}

function Variant({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-[300px] rounded-lg border bg-card p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

type V = "emoji" | "dot" | "bar" | "bg";

function Mini({ variant }: { variant: V }) {
  const cells = monthCells();
  return (
    <div>
      <div className="mb-2 text-center text-sm font-medium">Липень 2026 р.</div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const wx = WX[d];
          const bad = isBad(wx?.code);
          const busy = BUSY.has(d);
          const isToday = d === TODAY;
          const emoji = wx ? weatherMeta(wx.code).emoji : "";
          return (
            <div
              key={i}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs",
                isToday ? "bg-violet-600 text-white" : "hover:bg-accent",
                variant === "bg" && bad && !isToday
                  ? "bg-sky-100 dark:bg-sky-950/40"
                  : ""
              )}
            >
              {d}

              {/* A: емодзі поганої погоди у кутику */}
              {variant === "emoji" && bad && (
                <span className="absolute -right-0.5 -top-1 text-[10px]">
                  {emoji}
                </span>
              )}

              {/* B: синя крапля внизу (поряд із фіолетовою крапкою записів) */}
              {variant === "dot" && bad && !isToday && (
                <span className="absolute bottom-0.5 right-1 text-[8px] leading-none">
                  💧
                </span>
              )}

              {/* C: нижня синя смужка */}
              {variant === "bar" && bad && !isToday && (
                <span className="absolute inset-x-1 bottom-0.5 h-0.5 rounded-full bg-sky-500" />
              )}

              {/* D: заливка тла + маленька крапля */}
              {variant === "bg" && bad && !isToday && (
                <span className="absolute right-0.5 top-0 text-[8px] leading-none text-sky-500">
                  💧
                </span>
              )}

              {/* фіолетова крапка записів */}
              {busy && !isToday && (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1 w-1 rounded-full bg-violet-500",
                    variant === "dot" ? "left-1" : "left-1/2 -translate-x-1/2"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        Погана погода: {Object.keys(WX).filter((d) => isBad(WX[+d].code)).join(", ")} лип.
      </div>
    </div>
  );
}

// локальний cn (proto самодостатній)
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
