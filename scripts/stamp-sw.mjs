// Проставляє унікальну версію в out/sw.js після кожного білду.
//
// Навіщо: браузер вважає service worker новим тільки якщо байти sw.js
// відрізняються від тих, що він уже має. VERSION у public/sw.js був
// захардкожений ("v1"), тож після деплою браузер бачив той самий файл,
// не встановлював новий SW, не викликав activate — і старий кеш жив вічно.
// Користувач лишався на попередньому білді, навіть після кількох релізів.
//
// Працюємо з out/sw.js, а не з public/sw.js: джерело лишається чистим,
// git не бруднішає на кожному білді.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SW_PATH = resolve(process.cwd(), "out", "sw.js");

if (!existsSync(SW_PATH)) {
  console.warn("[stamp-sw] out/sw.js не знайдено — пропускаю");
  process.exit(0);
}

let sha = "nogit";
try {
  sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  // не git-репо або git недоступний — обійдемось міткою часу
}

const stamp = `${sha}-${Date.now().toString(36)}`;
const src = readFileSync(SW_PATH, "utf8");
const out = src.replace(
  /const VERSION = "[^"]*";/,
  `const VERSION = "${stamp}";`
);

if (out === src) {
  console.warn("[stamp-sw] рядок з VERSION не знайдено — sw.js не змінено");
  process.exit(0);
}

writeFileSync(SW_PATH, out);
console.log(`[stamp-sw] VERSION = ${stamp}`);
