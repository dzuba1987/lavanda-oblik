/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname, "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

(async () => {
  const catsSnap = await db.collection("categories").get();
  const prodsSnap = await db.collection("products").get();
  const testCatIds = new Set(catsSnap.docs.filter((d) => (d.data().name || "").toLowerCase().trim() === "test").map((d) => d.id));
  const testProdIds = new Set(prodsSnap.docs.filter((d) => {
    const n = (d.data().name || "").toLowerCase().trim();
    return n === "товар" || n === "test";
  }).map((d) => d.id));

  const txSnap = await db.collection("transactions").get();
  const refs = txSnap.docs.filter((d) => {
    const t = d.data();
    return testCatIds.has(t.categoryId) || testProdIds.has(t.productId);
  });

  refs.forEach((d) => {
    const t = d.data();
    console.log(`\n=== Transaction ${d.id} ===`);
    console.log(`  date: ${t.date?.toDate ? t.date.toDate().toISOString() : t.date}`);
    console.log(`  type: ${t.type}`);
    console.log(`  category: ${t.categoryName} (id=${t.categoryId})`);
    console.log(`  product:  ${t.productName} (id=${t.productId})`);
    console.log(`  amount:   ${t.totalAmount} = ${t.unitPrice} × ${t.quantity}`);
    console.log(`  note:     ${t.note || '—'}`);
    console.log(`  createdBy: ${t.createdBy}`);
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
