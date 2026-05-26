/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname,
    "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

(async () => {
  const [catsSnap, txSnap] = await Promise.all([
    db.collection("categories").get(),
    db.collection("transactions").get(),
  ]);

  // Усі категорії з довідника, по id
  const catsById = new Map();
  const catsByName = new Map();
  catsSnap.forEach((d) => {
    const c = d.data();
    catsById.set(d.id, { ...c, id: d.id });
    catsByName.set((c.name || "").trim().toLowerCase(), { ...c, id: d.id });
  });

  console.log(`📚 Довідник categories: ${catsSnap.size} записів`);

  // Розпис на income/expense
  const dictIncome = [...catsById.values()].filter((c) => c.type === "income");
  const dictExpense = [...catsById.values()].filter((c) => c.type === "expense");
  console.log(`   income: ${dictIncome.length}, expense: ${dictExpense.length}`);

  // Унікальні categoryName з транзакцій + рахуємо
  const txUsedByName = new Map(); // name → { count, type, sample tx, hasValidId }
  let txWithoutCategoryId = 0;
  let txWithDeadId = 0;
  txSnap.forEach((d) => {
    const t = d.data();
    const name = (t.categoryName || "").trim();
    const type = t.type;
    if (!name) return;
    const key = `${type}:${name.toLowerCase()}`;
    if (!txUsedByName.has(key)) {
      txUsedByName.set(key, { name, type, count: 0, totalAmount: 0, hasMatchingDict: false, catIdValid: 0 });
    }
    const rec = txUsedByName.get(key);
    rec.count++;
    rec.totalAmount += t.totalAmount || 0;
    // Чи categoryId валідний?
    if (t.categoryId) {
      if (catsById.has(t.categoryId)) rec.catIdValid++;
      else txWithDeadId++;
    } else {
      txWithoutCategoryId++;
    }
    // Чи є категорія з таким name у довіднику?
    if (catsByName.has(name.toLowerCase())) rec.hasMatchingDict = true;
  });

  console.log(`\n💰 Унікальних categoryName у транзакціях: ${txUsedByName.size}`);
  console.log(`   tx без categoryId: ${txWithoutCategoryId}`);
  console.log(`   tx з categoryId, що НЕ існує в довіднику: ${txWithDeadId}`);

  // Категорії з транзакцій, яких нема в довіднику
  console.log(`\n❌ Категорії з транзакцій ВІДСУТНІ у довіднику categories:`);
  const missing = [...txUsedByName.values()].filter((r) => !r.hasMatchingDict);
  if (missing.length === 0) {
    console.log("   (немає — усі назви категорій транзакцій є в довіднику)");
  } else {
    missing.sort((a, b) => b.count - a.count);
    for (const r of missing) {
      console.log(`   [${r.type}]  count=${r.count}  sum=${r.totalAmount.toFixed(0).padStart(8)}  «${r.name}»`);
    }
  }

  // Категорії з довідника, які НЕ використовуються транзакціями
  console.log(`\n⚪ Категорії з довідника БЕЗ транзакцій:`);
  const usedNames = new Set([...txUsedByName.values()].map((r) => r.name.toLowerCase()));
  const unused = [...catsById.values()].filter((c) => !usedNames.has((c.name || "").toLowerCase()));
  if (unused.length === 0) {
    console.log("   (усі категорії використовуються)");
  } else {
    for (const c of unused) {
      console.log(`   [${c.type}]  «${c.name}»`);
    }
  }

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
