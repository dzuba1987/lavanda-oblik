/* eslint-disable */
/**
 * Міграція: orders.status === "delivered" → "ready"
 * Запуск:
 *   node migrate-delivered-to-ready.js          # dry-run, тільки рахує
 *   node migrate-delivered-to-ready.js --apply  # пише в БД
 */
const admin = require("firebase-admin");
const path = require("path");

admin.initializeApp({
  credential: admin.credential.cert(
    require(path.resolve(
      __dirname,
      "../../invest-notify/storage/app/firebase/lavanda-service-account.json"
    ))
  ),
});
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");

(async () => {
  const snap = await db
    .collection("orders")
    .where("status", "==", "delivered")
    .get();

  console.log(`Знайдено замовлень зі status="delivered": ${snap.size}`);

  if (snap.size === 0) {
    console.log("Нічого мігрувати. Виходимо.");
    process.exit(0);
  }

  for (const d of snap.docs) {
    const o = d.data();
    console.log(
      `  ${d.id}  customer=${o.customerName ?? "—"}  total=${o.totalAmount}  deliveredAt=${o.deliveredAt?.toDate?.().toISOString?.() ?? "—"}`
    );
  }

  if (!APPLY) {
    console.log("\nDRY-RUN. Щоб запустити справді: node migrate-delivered-to-ready.js --apply");
    process.exit(0);
  }

  console.log("\nЗапускаю апдейт...");
  const batch = db.batch();
  for (const d of snap.docs) {
    batch.update(d.ref, {
      status: "ready",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`Готово. Оновлено ${snap.size} замовлень.`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
