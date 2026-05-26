/* eslint-disable */
/**
 * Одноразовий скрипт: вантажить стандартні довідники Лаванди у Firestore
 * через Admin SDK. Логіка повністю дзеркалить lib/data/dictionaries.ts.
 *
 * Запуск:
 *   cd functions
 *   node load-dictionaries.js
 */

const admin = require("firebase-admin");
const path = require("path");

const SA_PATH = path.resolve(
  __dirname,
  "../../invest-notify/storage/app/firebase/lavanda-service-account.json"
);

admin.initializeApp({
  credential: admin.credential.cert(require(SA_PATH)),
});

const db = admin.firestore();

// ── Палітра ─────────────────────────────────────────────────────────────
const C_VIOLET = "#7c5cbb";
const C_PINK = "#ec4899";
const C_AMBER = "#f59e0b";
const C_TEAL = "#14b8a6";
const C_GREEN = "#22c55e";
const C_PURPLE = "#a855f7";
const C_ROSE = "#fb7185";
const C_ZINC = "#64748b";

const E_RED = "#ef4444";
const E_ORANGE = "#fb923c";
const E_PINK = "#ec4899";
const E_INDIGO = "#6366f1";
const E_CYAN = "#06b6d4";
const E_LIME = "#84cc16";
const E_AMBER2 = "#eab308";
const E_PURPLE2 = "#a855f7";

const INCOME = [
  { name: "Букет сухоцвіт", color: C_PINK, sortOrder: 1 },
  { name: "Ефірна олія",    color: C_GREEN, sortOrder: 2 },
  { name: "Гідролат",       color: C_TEAL, sortOrder: 3 },
  { name: "Варення",        color: C_AMBER, sortOrder: 4 },
  { name: "Лаванда",        color: C_VIOLET, sortOrder: 5 },
  { name: "Гладіолуси",     color: C_PURPLE, sortOrder: 6 },
  { name: "Хризантеми",     color: C_ROSE, sortOrder: 7 },
  { name: "Інші товари",    color: C_ZINC, sortOrder: 8 },
];

const EXPENSE = [
  { name: "сировина та матеріали",  color: E_LIME, sortOrder: 100 },
  { name: "постійна зп",            color: E_RED, sortOrder: 110 },
  { name: "змінна зп",              color: E_RED, sortOrder: 111 },
  { name: "оренда приміщення",      color: E_ORANGE, sortOrder: 200 },
  { name: "комунальні витрати",     color: E_ORANGE, sortOrder: 201 },
  { name: "охорона приміщення",     color: E_ORANGE, sortOrder: 202 },
  { name: "протипожежка приміщення", color: E_ORANGE, sortOrder: 203 },
  { name: "реклама в соціальних мережах", color: E_PINK, sortOrder: 300 },
  { name: "рекламація на інших мед.сервісах/платформах", color: E_PINK, sortOrder: 301 },
  { name: "контексна реклама", color: E_PINK, sortOrder: 302 },
  { name: "sms/mail розсилка", color: E_PINK, sortOrder: 303 },
  { name: "витрати  по сайту", color: E_PINK, sortOrder: 304 },
  { name: "дизайн, друк банера", color: E_PINK, sortOrder: 305 },
  { name: "оренда банера", color: E_PINK, sortOrder: 306 },
  { name: "інша реклама (візитки, листівки, флаєра, телебачення, газета, реклама в ліфтах, кульки та ін. брендована інформація)", color: E_PINK, sortOrder: 307 },
  { name: "витрати на обслуговування машини", color: E_INDIGO, sortOrder: 400 },
  { name: "пальне", color: E_INDIGO, sortOrder: 401 },
  { name: "доставка нова пошта/укр.пошта, таксі та інші перевезення", color: E_INDIGO, sortOrder: 402 },
  { name: "Витрати на програмне забезпечення, технічна підтримка, системне адміністрування, обслуговування сервера та ін.", color: E_CYAN, sortOrder: 500 },
  { name: "Послуги зв'язоку, інтернету, ір-телефонії", color: E_CYAN, sortOrder: 501 },
  { name: "Господарчі витрати", color: E_AMBER2, sortOrder: 600 },
  { name: "Корпоративні витрати", color: E_AMBER2, sortOrder: 601 },
  { name: "Костюми для персоналу (костюми, кофти)", color: E_AMBER2, sortOrder: 602 },
  { name: "Канцелярія", color: E_AMBER2, sortOrder: 603 },
  { name: "Інші адміністративні витрати", color: E_AMBER2, sortOrder: 604 },
  { name: "Винагорода за консультаційні, інформаційні, аудиторські та інші послуги", color: E_AMBER2, sortOrder: 605 },
  { name: "Ліцензії", color: E_AMBER2, sortOrder: 606 },
  { name: "МШП, інвентар, прилади, техніка", color: E_AMBER2, sortOrder: 607 },
  { name: "Витрати на утримання ОЗ, інших необоротних матеріальних активів, пов'язаних зі збутом товарів, наданню послуг", color: E_AMBER2, sortOrder: 608 },
  { name: "Витрати на службові відрядження", color: E_AMBER2, sortOrder: 609 },
  { name: "Благодійна допомога", color: E_AMBER2, sortOrder: 610 },
  { name: "Податки", color: E_PURPLE2, sortOrder: 700 },
  { name: "Штрафи", color: E_PURPLE2, sortOrder: 701 },
  { name: "витрати на обслуговування рахунку", color: E_PURPLE2, sortOrder: 702 },
  { name: "еквайринг", color: E_PURPLE2, sortOrder: 703 },
  { name: "% за кредит", color: E_PURPLE2, sortOrder: 704 },
];

const PRODUCTS = [
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

async function main() {
  console.log("Reading existing categories + products...");
  const [catsSnap, prodsSnap] = await Promise.all([
    db.collection("categories").get(),
    db.collection("products").get(),
  ]);

  const existingCats = new Map();
  catsSnap.forEach((d) => existingCats.set(d.data().name, d.id));
  const existingProds = new Set();
  prodsSnap.forEach((d) => existingProds.add(d.data().name));

  console.log(`  existing: ${existingCats.size} categories, ${existingProds.size} products`);

  let batch = db.batch();
  let inBatch = 0;
  let categoriesAdded = 0;
  let categoriesSkipped = 0;
  const catIdByName = new Map(existingCats);

  for (const c of INCOME) {
    if (existingCats.has(c.name)) { categoriesSkipped++; continue; }
    const ref = db.collection("categories").doc();
    batch.set(ref, {
      name: c.name, type: "income", color: c.color, sortOrder: c.sortOrder,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    catIdByName.set(c.name, ref.id);
    categoriesAdded++; inBatch++;
    if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  for (const c of EXPENSE) {
    if (existingCats.has(c.name)) { categoriesSkipped++; continue; }
    const ref = db.collection("categories").doc();
    batch.set(ref, {
      name: c.name, type: "expense", color: c.color, sortOrder: c.sortOrder,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    catIdByName.set(c.name, ref.id);
    categoriesAdded++; inBatch++;
    if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch > 0) { await batch.commit(); batch = db.batch(); inBatch = 0; }

  let productsAdded = 0;
  let productsSkipped = 0;
  for (const p of PRODUCTS) {
    if (existingProds.has(p.name)) { productsSkipped++; continue; }
    const ref = db.collection("products").doc();
    batch.set(ref, {
      name: p.name,
      unit: p.unit,
      defaultPrice: null,
      defaultCategoryId: catIdByName.get(p.categoryName) || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    productsAdded++; inBatch++;
    if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch > 0) await batch.commit();

  console.log("\n=== Done ===");
  console.log(`Categories: added ${categoriesAdded}, skipped ${categoriesSkipped}`);
  console.log(`Products:   added ${productsAdded}, skipped ${productsSkipped}`);

  // Verify
  const [catsAfter, prodsAfter] = await Promise.all([
    db.collection("categories").get(),
    db.collection("products").get(),
  ]);
  let income = 0, expense = 0;
  catsAfter.forEach((d) => d.data().type === "income" ? income++ : expense++);
  console.log(`\nTotals in Firestore now:`);
  console.log(`  categories: ${catsAfter.size} (${income} income + ${expense} expense)`);
  console.log(`  products: ${prodsAfter.size}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
