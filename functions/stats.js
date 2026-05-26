/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname, "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

(async () => {
  const [tx, cu, su] = await Promise.all([
    db.collection("transactions").get(),
    db.collection("customers").get(),
    db.collection("suppliers").get(),
  ]);

  let income = 0, expense = 0, incomeSum = 0, expenseSum = 0;
  const perYearIncome = {}, perYearExpense = {};
  tx.forEach((d) => {
    const t = d.data();
    const year = t.date && t.date.toDate ? t.date.toDate().getFullYear() : 0;
    if (t.type === "income") {
      income++; incomeSum += t.totalAmount || 0;
      perYearIncome[year] = (perYearIncome[year] || 0) + (t.totalAmount || 0);
    } else {
      expense++; expenseSum += t.totalAmount || 0;
      perYearExpense[year] = (perYearExpense[year] || 0) + (t.totalAmount || 0);
    }
  });

  const fmt = (n) => n.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
  console.log(`Transactions: ${tx.size} (${income} income + ${expense} expense)`);
  console.log(`Customers:    ${cu.size}`);
  console.log(`Suppliers:    ${su.size}`);
  console.log(`\nЗагальний оборот:`);
  console.log(`  income:  ${fmt(incomeSum)} грн`);
  console.log(`  expense: ${fmt(expenseSum)} грн`);
  console.log(`  чистий:  ${fmt(incomeSum - expenseSum)} грн`);
  console.log(`\nПо роках (дохід / витрати / чистий):`);
  const years = [...new Set([...Object.keys(perYearIncome), ...Object.keys(perYearExpense)])].sort();
  for (const y of years) {
    const i = perYearIncome[y] || 0, e = perYearExpense[y] || 0;
    console.log(`  ${y}: ${fmt(i).padStart(12)} / ${fmt(e).padStart(12)} / ${fmt(i - e).padStart(12)}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
