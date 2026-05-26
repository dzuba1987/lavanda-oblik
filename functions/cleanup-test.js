/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname, "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

(async () => {
  // Знайти "test" категорію (case-insensitive) + товар "товар"
  const catsSnap = await db.collection("categories").get();
  const prodsSnap = await db.collection("products").get();

  const testCats = catsSnap.docs.filter((d) => {
    const n = (d.data().name || "").trim().toLowerCase();
    return n === "test";
  });
  const testProds = prodsSnap.docs.filter((d) => {
    const n = (d.data().name || "").trim().toLowerCase();
    return n === "товар" || n === "test";
  });

  console.log(`Found: ${testCats.length} test categories, ${testProds.length} test products`);
  testCats.forEach((d) => console.log(`  cat: ${d.id} — ${d.data().name} (${d.data().type})`));
  testProds.forEach((d) => console.log(`  prod: ${d.id} — ${d.data().name}`));

  // Перевірити чи десь використовуються
  const testCatIds = new Set(testCats.map((d) => d.id));
  const testProdIds = new Set(testProds.map((d) => d.id));

  const txSnap = await db.collection("transactions").get();
  const usedByTx = txSnap.docs.filter((d) => {
    const t = d.data();
    return testCatIds.has(t.categoryId) || testProdIds.has(t.productId);
  });

  const ordSnap = await db.collection("orders").get();
  const usedByOrders = ordSnap.docs.filter((d) => {
    const o = d.data();
    return (o.items || []).some((it) => testCatIds.has(it.categoryId) || testProdIds.has(it.productId));
  });

  console.log(`\nUsed by: ${usedByTx.length} transactions, ${usedByOrders.length} orders`);
  if (usedByOrders.length) {
    console.error("❌ Aborting: orders reference test entries. Clean manually first.");
    process.exit(1);
  }

  // Видаляємо ВСЕ: test categories, test products, ВСІ транзакції що їх юзають
  let batch = db.batch();
  usedByTx.forEach((d) => batch.delete(d.ref));
  [...testCats, ...testProds].forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`\n✅ Deleted: ${usedByTx.length} transactions, ${testCats.length} categories, ${testProds.length} products`);

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
