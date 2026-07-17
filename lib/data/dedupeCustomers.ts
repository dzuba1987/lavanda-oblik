import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { currentAudit } from "./audit";
import { tsToDate } from "@/lib/utils/format";
import type { Customer } from "./types";

/**
 * Дедуплікація клієнтів.
 *
 * Клієнти плодяться дублями бо форми (OrderForm/BookingForm/голосові замовлення/
 * імпорт) створюють нового клієнта інлайн, не звіряючись жорстко з наявними.
 * Тут групуємо за нормалізованим іменем, обираємо канонічного, зливаємо в нього
 * порожні поля з дублів, перепризначаємо посилання (orders/bookings/transactions)
 * і видаляємо дублі.
 *
 * Операція НЕЗВОРОТНА. UI має показати прев'ю (findCustomerDuplicates) до злиття.
 */

const MERGE_FIELDS = ["age", "source", "phone", "address", "notes"] as const;

/** Нормалізація імені для групування: trim + lower + згортання пробілів. */
export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export type DuplicateGroup = {
  /** Нормалізоване ім'я (ключ групи). */
  key: string;
  /** Клієнт, у якого зіллються решта. */
  canonical: Customer;
  /** Дублі, що будуть видалені. */
  duplicates: Customer[];
};

/** Кількість заповнених (не null/порожніх) полів — для вибору канонічного. */
function filledScore(c: Customer): number {
  return MERGE_FIELDS.reduce((n, f) => {
    const v = c[f];
    return v != null && String(v).trim() !== "" ? n + 1 : n;
  }, 0);
}

function createdMs(c: Customer): number {
  const d = tsToDate(c.createdAt);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Канонічний = найбільше заповнених полів; за рівності — найстаріший;
 * за рівності — найменший id (детермінізм).
 */
function pickCanonical(group: Customer[]): Customer {
  return [...group].sort((a, b) => {
    const s = filledScore(b) - filledScore(a);
    if (s !== 0) return s;
    const t = createdMs(a) - createdMs(b);
    if (t !== 0) return t;
    return a.id < b.id ? -1 : 1;
  })[0];
}

/** Читає клієнтів і повертає групи-дублі (без запису). */
export async function findCustomerDuplicates(): Promise<DuplicateGroup[]> {
  const snap = await getDocs(collection(firebase.db, "customers"));
  const customers = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Customer, "id">) }) as Customer
  );

  const groups = new Map<string, Customer[]>();
  for (const c of customers) {
    const key = normalizeName(c.name ?? "");
    if (!key) continue; // клієнтів без імені не чіпаємо
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }

  const result: DuplicateGroup[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const canonical = pickCanonical(group);
    result.push({
      key,
      canonical,
      duplicates: group.filter((c) => c.id !== canonical.id),
    });
  }
  // Найбільші групи вгорі.
  result.sort((a, b) => b.duplicates.length - a.duplicates.length);
  return result;
}

export type MergeResult = {
  groups: number;
  customersRemoved: number;
  ordersReassigned: number;
  bookingsReassigned: number;
  transactionsReassigned: number;
};

/** Мапа "стара назва колекції" → скільки посилань перепризначено. */
const REF_COLLECTIONS = ["orders", "bookings", "transactions"] as const;

/**
 * Зливає всі дублі: заповнює порожні поля канонічного, перепризначає
 * customerId/customerName у orders/bookings/transactions, видаляє дублі.
 * НЕЗВОРОТНО.
 */
export async function mergeCustomerDuplicates(): Promise<MergeResult> {
  const groups = await findCustomerDuplicates();
  const { uid, name } = currentAudit();

  // dupeId → canonical { id, name } для швидкого lookup під час перепризначення.
  const remap = new Map<string, { id: string; name: string }>();
  for (const g of groups) {
    for (const d of g.duplicates) {
      remap.set(d.id, { id: g.canonical.id, name: g.canonical.name });
    }
  }

  const res: MergeResult = {
    groups: groups.length,
    customersRemoved: 0,
    ordersReassigned: 0,
    bookingsReassigned: 0,
    transactionsReassigned: 0,
  };

  if (groups.length === 0) return res;

  // Батчимо всі записи; Firestore обмежує 500 операцій на батч.
  let batch = writeBatch(firebase.db);
  let count = 0;
  const flushIfNeeded = async () => {
    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(firebase.db);
      count = 0;
    }
  };
  const patch = async (ref: ReturnType<typeof doc>, data: DocumentData) => {
    batch.update(ref, data);
    count++;
    await flushIfNeeded();
  };
  const del = async (ref: ReturnType<typeof doc>) => {
    batch.delete(ref);
    count++;
    await flushIfNeeded();
  };

  // 1. Заповнюємо порожні поля канонічного з дублів (перший непорожній).
  for (const g of groups) {
    const merged: DocumentData = {};
    for (const f of MERGE_FIELDS) {
      const cur = g.canonical[f];
      if (cur != null && String(cur).trim() !== "") continue;
      const donor = g.duplicates.find(
        (d) => d[f] != null && String(d[f]).trim() !== ""
      );
      if (donor) merged[f] = donor[f];
    }
    if (Object.keys(merged).length > 0) {
      merged.updatedBy = uid;
      merged.updatedByName = name;
      merged.updatedAt = serverTimestamp();
      await patch(doc(firebase.db, "customers", g.canonical.id), merged);
    }
  }

  // 2. Перепризначаємо посилання в orders/bookings/transactions.
  for (const colName of REF_COLLECTIONS) {
    const snap = await getDocs(collection(firebase.db, colName));
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as { customerId?: string | null };
      const cid = data.customerId;
      if (!cid) continue;
      const target = remap.get(cid);
      if (!target) continue;
      await patch(doc(firebase.db, colName, docSnap.id), {
        customerId: target.id,
        customerName: target.name,
        updatedBy: uid,
        updatedByName: name,
        updatedAt: serverTimestamp(),
      });
      if (colName === "orders") res.ordersReassigned++;
      else if (colName === "bookings") res.bookingsReassigned++;
      else res.transactionsReassigned++;
    }
  }

  // 3. Видаляємо дублі.
  for (const g of groups) {
    for (const d of g.duplicates) {
      await del(doc(firebase.db, "customers", d.id));
      res.customersRemoved++;
    }
  }

  if (count > 0) await batch.commit();
  return res;
}
