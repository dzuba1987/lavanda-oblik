/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname, "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

(async () => {
  const cats = (await db.collection("categories").get())
    .docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.type.localeCompare(b.type) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const prods = (await db.collection("products").get())
    .docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const income = cats.filter((c) => c.type === "income");
  const expense = cats.filter((c) => c.type === "expense");

  const pad = (s, n) => (String(s) + " ".repeat(n)).slice(0, n);

  console.log(`\n┌─ Категорії доходу (${income.length}) ` + "─".repeat(40));
  income.forEach((c) =>
    console.log(`│ ${pad(c.color, 8)} ${pad(c.sortOrder, 4)} ${c.name}`)
  );
  console.log("└" + "─".repeat(60));

  console.log(`\n┌─ Категорії витрат (${expense.length}) ` + "─".repeat(40));
  expense.forEach((c) =>
    console.log(`│ ${pad(c.color, 8)} ${pad(c.sortOrder, 5)} ${c.name}`)
  );
  console.log("└" + "─".repeat(60));

  console.log(`\n┌─ Товари/послуги (${prods.length}) ` + "─".repeat(40));
  const catById = new Map(cats.map((c) => [c.id, c.name]));
  prods.forEach((p) => {
    const catName = p.defaultCategoryId ? catById.get(p.defaultCategoryId) || "—" : "—";
    console.log(`│ ${pad(p.unit, 6)} ${pad(catName, 20)} ${p.name}`);
  });
  console.log("└" + "─".repeat(60));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
