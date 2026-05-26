/* eslint-disable */
const admin = require("firebase-admin");
const path = require("path");
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(__dirname,
    "../../invest-notify/storage/app/firebase/lavanda-service-account.json"))),
});
const db = admin.firestore();

const COLLECTIONS = ["categories", "products", "suppliers", "customers", "transactions", "orders"];

(async () => {
  const counts = {};
  for (const coll of COLLECTIONS) {
    const snap = await db.collection(coll).where("seed", "==", true).get();
    if (snap.empty) {
      counts[coll] = 0;
      continue;
    }
    // chunked batch delete
    const docs = snap.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += Math.min(400, docs.length - i);
    }
    counts[coll] = deleted;
  }
  console.log("Deleted seed: true docs by collection:");
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(15)} ${v}`));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
