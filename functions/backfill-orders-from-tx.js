/* eslint-disable */
/**
 * Backfill: створює замовлення (orders) з існуючих income-транзакцій.
 *
 * Групування: date(Europe/Kyiv, YYYY-MM-DD) | customerId | categoryId
 *   – одна група = одне нове замовлення зі статусом "ready"
 *   – транзакції без customerId йдуть кожна окремим замовленням
 *
 * Опрацьовуються УСІ income-транзакції — у тому числі ті, що вже мають orderId
 * (буде перепривʼязано до нового замовлення; старі orders отримають stale
 *  transactionIds). Див. розділ "WARNING" у dry-run-звіті.
 *
 *   node backfill-orders-from-tx.js                       # dry-run, нічого не пише
 *   node backfill-orders-from-tx.js --apply               # реально створює замовлення
 *   node backfill-orders-from-tx.js --apply --limit 3     # створює лише 3 замовлення (для тесту)
 *   node backfill-orders-from-tx.js --apply --skip-linked # пропускає tx, які вже мають orderId
 */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname,
    "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const APPLY = process.argv.includes("--apply");
const SKIP_LINKED = process.argv.includes("--skip-linked");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i < 0) return Infinity;
  const n = parseInt(process.argv[i + 1], 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("--limit потребує додатне число");
  }
  return n;
})();

/** Дата у Київському часі як YYYY-MM-DD (стабільно з 00:00 UTC+2/+3). */
function kyivDateKey(ts) {
  return ts.toDate().toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" });
}

(async () => {
  console.log(
    `Mode: ${APPLY ? "APPLY (writes will happen)" : "DRY-RUN (no writes)"}` +
      (LIMIT !== Infinity ? `  | limit: ${LIMIT} груп` : "") +
      (SKIP_LINKED ? `  | skip-linked` : "") +
      `\n`
  );

  const txSnap = await db
    .collection("transactions")
    .where("type", "==", "income")
    .get();
  console.log(`Income transactions у базі: ${txSnap.size}`);

  // --- Групування ---
  const groups = new Map(); // groupKey -> [{ id, data }]
  const oldOrderIds = new Set();
  let withOrderId = 0;
  let skippedLinked = 0;
  let withoutCustomer = 0;
  let skippedBadData = 0;

  txSnap.forEach((doc) => {
    const t = doc.data();
    if (!t.date || !t.categoryId) {
      console.warn(`  ⚠ skip tx ${doc.id}: відсутній date або categoryId`);
      skippedBadData++;
      return;
    }
    if (t.orderId) {
      withOrderId++;
      oldOrderIds.add(t.orderId);
      if (SKIP_LINKED) {
        skippedLinked++;
        return;
      }
    }

    const dk = kyivDateKey(t.date);
    let key;
    if (t.customerId) {
      key = `${dk}|cust:${t.customerId}|cat:${t.categoryId}`;
    } else {
      withoutCustomer++;
      // Без клієнта — кожна tx — своє замовлення (унікальний key).
      key = `${dk}|notx:${doc.id}|cat:${t.categoryId}`;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: doc.id, data: t });
  });

  console.log(`\nГруп (= майбутніх замовлень): ${groups.size}`);
  console.log(`  tx без customerId (індивідуальні замовлення): ${withoutCustomer}`);
  console.log(`  tx з пропущеними полями (skip):              ${skippedBadData}`);

  if (withOrderId > 0) {
    if (SKIP_LINKED) {
      console.log(`\n✓ Пропущено ${skippedLinked} tx з існуючим orderId (--skip-linked).`);
    } else {
      console.log(`\n⚠ WARNING: ${withOrderId} tx вже мають orderId.`);
      console.log(`            ${oldOrderIds.size} існуючих замовлень будуть перепривʼязані.`);
      console.log(`            Їхні поля transactionIds стануть stale.`);
      console.log(`            Якщо це не те, чого ти хочеш — Ctrl+C і додай --skip-linked.`);
    }
  }

  // --- План ---
  const plan = [];
  for (const [key, txs] of groups) {
    const first = txs[0].data;
    const earliestDate = txs
      .map((x) => x.data.date.toDate())
      .sort((a, b) => a - b)[0];
    const ts = Timestamp.fromDate(earliestDate);
    const total = txs.reduce((s, x) => s + (Number(x.data.totalAmount) || 0), 0);

    const items = txs.map((x) => ({
      productId: x.data.productId || null,
      productName: x.data.productName || x.data.categoryName || "—",
      categoryId: x.data.categoryId,
      categoryName: x.data.categoryName || "",
      unitPrice: Number(x.data.unitPrice) || 0,
      quantity: Number(x.data.quantity) || 1,
      totalAmount: Number(x.data.totalAmount) || 0,
    }));

    const notes =
      txs
        .map((x) => x.data.note)
        .filter((n) => n && String(n).trim())
        .join("\n") || null;

    plan.push({
      key,
      txIds: txs.map((x) => x.id),
      order: {
        customerId: first.customerId || null,
        customerName: first.customerName || null,
        phone: null,
        items,
        totalAmount: total,
        deadline: null,
        status: "ready",
        notes,
        commentsCount: 0,
        transactionIds: txs.map((x) => x.id),
        photos: [],
        delivery: null,
        createdBy: first.createdBy || "backfill",
        createdByName: first.createdByName || null,
        updatedBy: first.createdBy || "backfill",
        updatedByName: first.createdByName || null,
        createdAt: ts,
        updatedAt: ts,
        deliveredAt: ts,
      },
    });
  }

  // Детермінований порядок — щоб --limit брав однакові групи між запусками.
  plan.sort((a, b) => {
    const da = a.order.createdAt.toMillis();
    const db_ = b.order.createdAt.toMillis();
    if (da !== db_) return da - db_;
    return (a.order.customerName || "").localeCompare(b.order.customerName || "");
  });

  const totalGroups = plan.length;
  if (plan.length > LIMIT) {
    plan.length = LIMIT;
    console.log(`\n⚠ --limit ${LIMIT}: оброблю лише ${LIMIT} з ${totalGroups} груп.`);
  }

  // --- Підсумок по дозах ---
  const totalSum = plan.reduce((s, p) => s + p.order.totalAmount, 0);
  const maxItems = plan.reduce((m, p) => Math.max(m, p.order.items.length), 0);
  console.log(`\nЗагальна сума всіх замовлень: ${totalSum.toFixed(2)}`);
  console.log(`Найбільше items в одному замовленні: ${maxItems}`);

  console.log(`\nПриклади (перші 5 груп):`);
  plan.slice(0, 5).forEach((p, i) => {
    const o = p.order;
    const d = o.createdAt.toDate().toISOString().slice(0, 10);
    console.log(
      `  [${i + 1}] ${d}  customer="${o.customerName || "—"}"  items=${
        o.items.length
      }  total=${o.totalAmount}  tx=${p.txIds.length}`
    );
    o.items.slice(0, 3).forEach((it) => {
      console.log(
        `        · ${it.productName} (${it.categoryName}) × ${it.quantity} = ${it.totalAmount}`
      );
    });
    if (o.items.length > 3) console.log(`        … +${o.items.length - 3} ще`);
  });

  if (!APPLY) {
    console.log(`\n[dry-run] Нічого не записано. Запусти з --apply щоб виконати.`);
    process.exit(0);
  }

  // --- Запис ---
  console.log(`\n📝 Записую...`);
  let batch = db.batch();
  let inBatch = 0;
  let createdOrders = 0;
  let updatedTxs = 0;

  async function flush() {
    if (inBatch === 0) return;
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }

  for (const p of plan) {
    const orderRef = db.collection("orders").doc();
    batch.set(orderRef, p.order);
    inBatch++;
    createdOrders++;

    for (const txId of p.txIds) {
      batch.update(db.collection("transactions").doc(txId), {
        orderId: orderRef.id,
      });
      inBatch++;
      updatedTxs++;
      // Залишаємо запас — у Firestore ліміт 500 операцій на batch.
      if (inBatch >= 400) await flush();
    }
  }
  await flush();

  console.log(
    `✅ Готово. Створено замовлень: ${createdOrders}, оновлено tx.orderId: ${updatedTxs}`
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
