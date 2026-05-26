/**
 * Стандартні довідники з реального облікового файлу Лаванди
 * (`Продажі-Витрати КВІТИ.ods`, лист «Словник»):
 *
 *  • 8 категорій income — товарні групи
 *  • 36 категорій expense — план рахунків витрат
 *  • 24 продукти (з мапінгом на категорію + одиниця парситься з назви)
 *  • 8 джерел "Звідки про нас дізнались?"
 *
 * `applyDictionaries(uid)` — ідемпотентний upsert: дивиться які записи з
 * таким же name вже існують у Firestore та додає тільки відсутні. Безпечно
 * викликати багато разів.
 */

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { currentAudit } from "./audit";
import type { Category, Product, TransactionType } from "./types";

// ── Тематична палітра (узгоджена із загальною лавандовою) ──────────────
//   Категорії-income групуються за тематикою — кольори різнокаталогічні,
//   щоб у графіках кожна група читалась окремо.
const C_VIOLET = "#7c5cbb";   // лаванда
const C_PINK = "#ec4899";     // букет сухоцвіт
const C_AMBER = "#f59e0b";    // варення
const C_TEAL = "#14b8a6";     // гідролат
const C_GREEN = "#22c55e";    // ефірна олія
const C_PURPLE = "#a855f7";   // гладіолуси
const C_ROSE = "#fb7185";     // хризантеми
const C_ZINC = "#64748b";     // інше

// expense — більш приглушені тони, кольори по групах рахунків
const E_RED = "#ef4444";       // ЗП
const E_ORANGE = "#fb923c";    // оренда / приміщення
const E_PINK = "#ec4899";      // реклама
const E_INDIGO = "#6366f1";    // транспорт
const E_CYAN = "#06b6d4";      // IT / зв'язок
const E_LIME = "#84cc16";      // сировина
const E_AMBER2 = "#eab308";    // адмін / госп.
const E_PURPLE2 = "#a855f7";   // фінанси / податки

// ── 8 income категорій ─────────────────────────────────────────────────
export const LAVANDA_INCOME_CATEGORIES: ReadonlyArray<
  Omit<Category, "id" | "createdAt" | "sortOrder"> & { sortOrder: number }
> = [
  { name: "Букет сухоцвіт", type: "income", color: C_PINK, sortOrder: 1 },
  { name: "Ефірна олія",    type: "income", color: C_GREEN, sortOrder: 2 },
  { name: "Гідролат",       type: "income", color: C_TEAL, sortOrder: 3 },
  { name: "Варення",        type: "income", color: C_AMBER, sortOrder: 4 },
  { name: "Лаванда",        type: "income", color: C_VIOLET, sortOrder: 5 },
  { name: "Гладіолуси",     type: "income", color: C_PURPLE, sortOrder: 6 },
  { name: "Хризантеми",     type: "income", color: C_ROSE, sortOrder: 7 },
  { name: "Інші товари",    type: "income", color: C_ZINC, sortOrder: 8 },
];

// ── 36 expense категорій ───────────────────────────────────────────────
export const LAVANDA_EXPENSE_CATEGORIES: ReadonlyArray<
  Omit<Category, "id" | "createdAt" | "sortOrder"> & { sortOrder: number }
> = [
  // сировина / зарплата
  { name: "сировина та матеріали", type: "expense", color: E_LIME, sortOrder: 100 },
  { name: "постійна зп",           type: "expense", color: E_RED, sortOrder: 110 },
  { name: "змінна зп",             type: "expense", color: E_RED, sortOrder: 111 },
  // приміщення
  { name: "оренда приміщення",     type: "expense", color: E_ORANGE, sortOrder: 200 },
  { name: "комунальні витрати",    type: "expense", color: E_ORANGE, sortOrder: 201 },
  { name: "охорона приміщення",    type: "expense", color: E_ORANGE, sortOrder: 202 },
  { name: "протипожежка приміщення", type: "expense", color: E_ORANGE, sortOrder: 203 },
  // реклама
  { name: "реклама в соціальних мережах",                                                 type: "expense", color: E_PINK, sortOrder: 300 },
  { name: "рекламація на інших мед.сервісах/платформах",                                   type: "expense", color: E_PINK, sortOrder: 301 },
  { name: "контексна реклама",                                                            type: "expense", color: E_PINK, sortOrder: 302 },
  { name: "sms/mail розсилка",                                                            type: "expense", color: E_PINK, sortOrder: 303 },
  { name: "витрати  по сайту",                                                            type: "expense", color: E_PINK, sortOrder: 304 },
  { name: "дизайн, друк банера",                                                          type: "expense", color: E_PINK, sortOrder: 305 },
  { name: "оренда банера",                                                                type: "expense", color: E_PINK, sortOrder: 306 },
  { name: "інша реклама (візитки, листівки, флаєра, телебачення, газета, реклама в ліфтах, кульки та ін. брендована інформація)", type: "expense", color: E_PINK, sortOrder: 307 },
  // транспорт
  { name: "витрати на обслуговування машини",                                  type: "expense", color: E_INDIGO, sortOrder: 400 },
  { name: "пальне",                                                            type: "expense", color: E_INDIGO, sortOrder: 401 },
  { name: "доставка нова пошта/укр.пошта, таксі та інші перевезення",          type: "expense", color: E_INDIGO, sortOrder: 402 },
  // IT / зв'язок
  { name: "Витрати на програмне забезпечення, технічна підтримка, системне адміністрування, обслуговування сервера та ін.", type: "expense", color: E_CYAN, sortOrder: 500 },
  { name: "Послуги зв'язоку, інтернету, ір-телефонії",                         type: "expense", color: E_CYAN, sortOrder: 501 },
  // адмін / госп.
  { name: "Господарчі витрати",                                                type: "expense", color: E_AMBER2, sortOrder: 600 },
  { name: "Корпоративні витрати",                                              type: "expense", color: E_AMBER2, sortOrder: 601 },
  { name: "Костюми для персоналу (костюми, кофти)",                            type: "expense", color: E_AMBER2, sortOrder: 602 },
  { name: "Канцелярія",                                                        type: "expense", color: E_AMBER2, sortOrder: 603 },
  { name: "Інші адміністративні витрати",                                      type: "expense", color: E_AMBER2, sortOrder: 604 },
  { name: "Винагорода за консультаційні, інформаційні, аудиторські та інші послуги", type: "expense", color: E_AMBER2, sortOrder: 605 },
  { name: "Ліцензії",                                                          type: "expense", color: E_AMBER2, sortOrder: 606 },
  { name: "МШП, інвентар, прилади, техніка",                                   type: "expense", color: E_AMBER2, sortOrder: 607 },
  { name: "Витрати на утримання ОЗ, інших необоротних матеріальних активів, пов'язаних зі збутом товарів, наданню послуг", type: "expense", color: E_AMBER2, sortOrder: 608 },
  { name: "Витрати на службові відрядження",                                   type: "expense", color: E_AMBER2, sortOrder: 609 },
  { name: "Благодійна допомога",                                               type: "expense", color: E_AMBER2, sortOrder: 610 },
  // фінанси / податки
  { name: "Податки",                          type: "expense", color: E_PURPLE2, sortOrder: 700 },
  { name: "Штрафи",                           type: "expense", color: E_PURPLE2, sortOrder: 701 },
  { name: "витрати на обслуговування рахунку", type: "expense", color: E_PURPLE2, sortOrder: 702 },
  { name: "еквайринг",                        type: "expense", color: E_PURPLE2, sortOrder: 703 },
  { name: "% за кредит",                      type: "expense", color: E_PURPLE2, sortOrder: 704 },
];

// ── 24 продукти із мапінгом на категорію ───────────────────────────────
type ProductSeed = {
  name: string;
  unit: string;
  categoryName: string;
};

export const LAVANDA_PRODUCTS: ReadonlyArray<ProductSeed> = [
  { name: "Букет сухоцвіт Малий",                       unit: "шт",   categoryName: "Букет сухоцвіт" },
  { name: "Букет сухоцвіт Середній",                    unit: "шт",   categoryName: "Букет сухоцвіт" },
  { name: "Букет сухоцвіт Великий",                     unit: "шт",   categoryName: "Букет сухоцвіт" },
  { name: "Саше",                                       unit: "шт",   categoryName: "Букет сухоцвіт" },
  { name: "Ефірна олія 3мл",                            unit: "шт",   categoryName: "Ефірна олія" },
  { name: "Ефірна олія 5мл",                            unit: "шт",   categoryName: "Ефірна олія" },
  { name: "Ефірна олія 10мл",                           unit: "шт",   categoryName: "Ефірна олія" },
  { name: "Ефірна олія 10мл ролик",                     unit: "шт",   categoryName: "Ефірна олія" },
  { name: "Ефірна олія 10мл крапельниця",               unit: "шт",   categoryName: "Ефірна олія" },
  { name: "Варення лавандове 130мл",                    unit: "шт",   categoryName: "Варення" },
  { name: "Варення лавандове 180мл",                    unit: "шт",   categoryName: "Варення" },
  { name: "Варення лавандове 212мл",                    unit: "шт",   categoryName: "Варення" },
  { name: "Гідролат 100мл",                             unit: "шт",   categoryName: "Гідролат" },
  { name: "Гідролат 200мл",                             unit: "шт",   categoryName: "Гідролат" },
  { name: "Гідролат 1л",                                unit: "шт",   categoryName: "Гідролат" },
  { name: "Саджанці лаванди",                           unit: "шт",   categoryName: "Лаванда" },
  { name: "Зрізана лаванда",                            unit: "кг",   categoryName: "Лаванда" },
  { name: "Бранч",                                      unit: "люд.", categoryName: "Інші товари" },
  { name: "Майстер-клас",                               unit: "люд.", categoryName: "Інші товари" },
  { name: "Фотосесія",                                  unit: "год",  categoryName: "Інші товари" },
  { name: "Прогулянка",                                 unit: "год",  categoryName: "Інші товари" },
  { name: "Квіти гладіолуса",                           unit: "шт",   categoryName: "Гладіолуси" },
  { name: "Цибулина гладіолуса (1 набір — 20 шт)",      unit: "набір", categoryName: "Гладіолуси" },
  { name: "Хризантема в горщику",                       unit: "шт",   categoryName: "Хризантеми" },
  { name: "Подарункова коробка (брендована)",           unit: "шт",   categoryName: "Інші товари" },
];

// ── 8 джерел "Звідки про нас" ──────────────────────────────────────────
export const CUSTOMER_SOURCES = [
  "постійний клієнт",
  "інстаграм",
  "фейсбук",
  "рекомендація друзів",
  "реклама",
  "група Калинівка",
  "група Вінниця",
  "ОЛХ",
] as const;

export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

// ── Upsert ─────────────────────────────────────────────────────────────

export type ApplyResult = {
  categoriesAdded: number;
  categoriesSkipped: number;
  productsAdded: number;
  productsSkipped: number;
};

/**
 * Завантажує стандартні довідники у Firestore. Безпечно для повторних
 * викликів — для кожного запису перевіряємо наявність по `name` і не
 * створюємо дубль.
 *
 * Окремо не позначаємо записи прапором `seed: true`, бо це не тестові
 * дані, а реальний словник, що має лишатись у системі.
 */
export async function applyDictionaries(): Promise<ApplyResult> {
  const db = firebase.db;
  const audit = currentAudit();
  const auditPayload = {
    createdBy: audit.uid,
    createdByName: audit.name,
    updatedBy: audit.uid,
    updatedByName: audit.name,
  };

  // 1. Зчитати існуючі категорії і товари (для перевірки дублів за name)
  const [catsSnap, prodsSnap] = await Promise.all([
    getDocs(collection(db, "categories")),
    getDocs(collection(db, "products")),
  ]);

  const existingCatNames = new Map<string, { id: string; type: TransactionType }>();
  for (const d of catsSnap.docs) {
    const data = d.data() as Pick<Category, "name" | "type">;
    existingCatNames.set(data.name, { id: d.id, type: data.type });
  }

  const existingProdNames = new Set<string>();
  for (const d of prodsSnap.docs) {
    const data = d.data() as Pick<Product, "name">;
    existingProdNames.add(data.name);
  }

  // 2. Категорії — додаємо відсутні. Запам'ятовуємо id під кожне ім'я
  //    (потрібно для defaultCategoryId продуктів).
  const catIdByName = new Map<string, string>();
  let batch = writeBatch(db);
  let inBatch = 0;
  let categoriesAdded = 0;
  let categoriesSkipped = 0;

  const ALL_CATS = [...LAVANDA_INCOME_CATEGORIES, ...LAVANDA_EXPENSE_CATEGORIES];
  for (const c of ALL_CATS) {
    const existing = existingCatNames.get(c.name);
    if (existing) {
      catIdByName.set(c.name, existing.id);
      categoriesSkipped++;
      continue;
    }
    const ref = doc(collection(db, "categories"));
    const ts = serverTimestamp();
    batch.set(ref, {
      name: c.name,
      type: c.type,
      color: c.color,
      sortOrder: c.sortOrder,
      ...auditPayload,
      createdAt: ts,
      updatedAt: ts,
    });
    catIdByName.set(c.name, ref.id);
    categoriesAdded++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      inBatch = 0;
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    batch = writeBatch(db);
    inBatch = 0;
  }

  // 3. Продукти — додаємо відсутні, мапимо на категорію за іменем
  let productsAdded = 0;
  let productsSkipped = 0;

  for (const p of LAVANDA_PRODUCTS) {
    if (existingProdNames.has(p.name)) {
      productsSkipped++;
      continue;
    }
    const catId = catIdByName.get(p.categoryName) ?? null;
    const ref = doc(collection(db, "products"));
    const ts = serverTimestamp();
    batch.set(ref, {
      name: p.name,
      unit: p.unit,
      defaultPrice: null,
      defaultCategoryId: catId,
      ...auditPayload,
      createdAt: ts,
      updatedAt: ts,
    });
    productsAdded++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  return {
    categoriesAdded,
    categoriesSkipped,
    productsAdded,
    productsSkipped,
  };
}
