import { collection, getDocs, Timestamp } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";

/**
 * Клієнтський дамп Firestore для бекапу перед ризикованими операціями
 * (напр. дедуп клієнтів). Читає через залогіненого admin — правила дозволяють.
 * Не потребує service account / gcloud.
 *
 * Timestamp серіалізується як {__type__:"timestamp", seconds, nanoseconds},
 * тож дамп потенційно відновлюваний, а не просто читабельний.
 */

/** Топ-рівневі колекції проєкту. */
const COLLECTIONS = [
  "bookings",
  "categories",
  "customers",
  "orders",
  "products",
  "settings",
  "suppliers",
  "transactions",
  "users",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(value: any): any {
  if (value instanceof Timestamp) {
    return {
      __type__: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

export type DbDump = {
  exportedAt: string;
  project: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collections: Record<string, Record<string, any>>;
  /** orders/{orderId}/comments підколекції. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subcollections: { comments: Record<string, Record<string, any>> };
  counts: Record<string, number>;
};

/** Збирає повний дамп у пам'ять. */
export async function exportDatabase(): Promise<DbDump> {
  const db = firebase.db;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections: Record<string, Record<string, any>> = {};
  const counts: Record<string, number> = {};

  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs: Record<string, any> = {};
    for (const d of snap.docs) docs[d.id] = serialize(d.data());
    collections[name] = docs;
    counts[name] = snap.size;
  }

  // Коментарі — підколекція кожного замовлення.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments: Record<string, Record<string, any>> = {};
  let commentsCount = 0;
  for (const orderId of Object.keys(collections.orders ?? {})) {
    const snap = await getDocs(collection(db, "orders", orderId, "comments"));
    if (snap.empty) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs: Record<string, any> = {};
    for (const d of snap.docs) docs[d.id] = serialize(d.data());
    comments[orderId] = docs;
    commentsCount += snap.size;
  }
  counts.comments = commentsCount;

  return {
    exportedAt: new Date().toISOString(),
    project: "lavanda-oblik",
    collections,
    subcollections: { comments },
    counts,
  };
}

/** Тригерить завантаження дампа як JSON-файл у браузері. */
export function downloadDump(dump: DbDump): void {
  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = dump.exportedAt.replace(/[:.]/g, "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `lavanda-dump-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
