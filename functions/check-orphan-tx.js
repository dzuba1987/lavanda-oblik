/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname,
    "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

const ORPHAN_NAMES = new Set([
  "продаж сухоцвіту", "продаж саджанців", "продаж букетів",
  "косметика", "екскурсії",
  "зарплата", "оренда", "добрива", "реклама", "упаковка",
  "інше", "паливо", "насіння та саджанці",
]);

(async () => {
  const txSnap = await db.collection("transactions").get();
  const orphans = [];
  let withSeed = 0;
  let withImport = 0;
  let plain = 0;

  txSnap.forEach((d) => {
    const t = d.data();
    const name = (t.categoryName || "").trim().toLowerCase();
    if (!ORPHAN_NAMES.has(name)) return;
    orphans.push({ id: d.id, ...t });
    if (t.seed === true) withSeed++;
    else if (t.importedFrom) withImport++;
    else plain++;
  });

  console.log(`Orphan transactions: ${orphans.length}`);
  console.log(`  with seed:true:       ${withSeed}`);
  console.log(`  with importedFrom:    ${withImport}`);
  console.log(`  без жодних маркерів: ${plain}`);

  // Дати — щоб зрозуміти коли створювалися
  const dates = orphans
    .map((t) => t.date?.toDate ? t.date.toDate() : null)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (dates.length) {
    console.log(`  date range: ${dates[0].toISOString().slice(0,10)} … ${dates[dates.length-1].toISOString().slice(0,10)}`);
  }
  const createdAts = orphans
    .map((t) => t.createdAt?.toDate ? t.createdAt.toDate() : null)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (createdAts.length) {
    console.log(`  createdAt range: ${createdAts[0].toISOString()} … ${createdAts[createdAts.length-1].toISOString()}`);
  }

  // Показуємо 5 прикладів
  console.log(`\nПриклади:`);
  orphans.slice(0, 5).forEach((t) => {
    console.log(`  id=${t.id}  type=${t.type}  category=«${t.categoryName}»  total=${t.totalAmount}  seed=${t.seed}  importedFrom=${t.importedFrom || '—'}  createdBy=${t.createdBy?.slice(0,10)}…`);
  });

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
