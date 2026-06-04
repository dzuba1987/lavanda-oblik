import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch,
  type QueryConstraint,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { notifyNewOrder, notifyOrderStatusChange } from "@/lib/notify/telegram";
import { formatDate } from "@/lib/utils/format";
import { currentAudit } from "./audit";
import { adjustStock } from "./products";
import type {
  Category,
  Delivery,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  TransactionType,
} from "./types";

const COLLECTION = "orders";

export type OrderInput = {
  customerId: string | null;
  customerName: string | null;
  phone: string | null;
  items: OrderItem[];
  totalAmount: number;
  deadline: Date | null;
  status: OrderStatus;
  notes: string | null;
  /** Inline JPEG-фото у вигляді data URL (data:image/jpeg;base64,...). */
  photos: string[];
  delivery: Delivery | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
};

export type OrderFilter = {
  status?: OrderStatus;
  from?: Date;
  to?: Date;
};

function col() {
  return collection(firebase.db, COLLECTION);
}

export async function listOrders(filter: OrderFilter = {}): Promise<Order[]> {
  const constraints: QueryConstraint[] = [];
  if (filter.status) constraints.push(where("status", "==", filter.status));
  if (filter.from)
    constraints.push(where("createdAt", ">=", Timestamp.fromDate(filter.from)));
  if (filter.to)
    constraints.push(where("createdAt", "<=", Timestamp.fromDate(filter.to)));
  constraints.push(orderBy("createdAt", "desc"));

  const snap = await getDocs(query(col(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
}

/**
 * Generates a fresh document ID without writing. Дозволяє відкрити форму
 * нового замовлення з відомим id (зараз не критично, але корисно для
 * подальших навігаційних флоу).
 */
export function newOrderId(): string {
  return doc(col()).id;
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(firebase.db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Order;
}

export async function createOrder(
  id: string,
  input: OrderInput,
  uid?: string,
  createdByNameArg: string | null = null
): Promise<void> {
  const audit = currentAudit();
  const createdBy = uid || audit.uid;
  const createdByName = createdByNameArg ?? audit.name;
  const ts = serverTimestamp();
  await setDoc(doc(firebase.db, COLLECTION, id), {
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    items: input.items,
    totalAmount: input.totalAmount,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    status: input.status,
    notes: input.notes,
    photos: input.photos,
    delivery: input.delivery,
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    commentsCount: 0,
    transactionIds: [],
    createdBy,
    createdByName,
    updatedBy: createdBy,
    updatedByName: createdByName,
    createdAt: ts,
    updatedAt: ts,
    deliveredAt: null,
  });

  const firstItem = input.items[0];
  notifyNewOrder({
    orderId: id,
    customerName: input.customerName,
    createdByName,
    totalAmount: input.totalAmount,
    itemsCount: input.items.length,
    firstItem: firstItem
      ? `${firstItem.productName} × ${firstItem.quantity}`
      : null,
    deadline: input.deadline ? formatDate(input.deadline) : null,
  }).catch((e) => console.warn("notifyNewOrder failed", e));
}

export async function updateOrder(
  id: string,
  input: OrderInput
): Promise<void> {
  const audit = currentAudit();
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    items: input.items,
    totalAmount: input.totalAmount,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    status: input.status,
    notes: input.notes,
    photos: input.photos,
    delivery: input.delivery,
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    updatedBy: audit.uid,
    updatedByName: audit.name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Простий перехід статусу без побічних ефектів.
 * Для першого переходу в 'ready' (створення транзакцій income) — використовуйте
 * completeOrder. Для повторного ready (коли transactionIds вже не порожній)
 * можна викликати цей метод напряму, щоб не дублювати транзакції.
 *
 * Якщо передано `meta.previousStatus` і він відрізняється від нового —
 * автоматично шле TG-нотифікацію про зміну статусу.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  meta?: {
    previousStatus?: OrderStatus;
    customerName?: string | null;
  }
): Promise<void> {
  const audit = currentAudit();
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    status,
    updatedBy: audit.uid,
    updatedByName: audit.name,
    updatedAt: serverTimestamp(),
  });

  if (meta?.previousStatus && meta.previousStatus !== status) {
    notifyOrderStatusChange({
      orderId: id,
      customerName: meta.customerName ?? null,
      changedByName: audit.name,
      fromStatus: meta.previousStatus,
      toStatus: status,
    }).catch((e) => console.warn("notifyOrderStatusChange failed", e));
  }
}

/**
 * Швидке оновлення оплати без повного збереження форми (маркування зі списку).
 * Якщо paymentStatus !== "paid" — спосіб оплати скидається в null.
 */
export async function updateOrderPayment(
  id: string,
  paymentStatus: PaymentStatus,
  paymentMethod: PaymentMethod | null
): Promise<void> {
  const audit = currentAudit();
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    paymentStatus,
    paymentMethod: paymentStatus === "paid" ? paymentMethod : null,
    updatedBy: audit.uid,
    updatedByName: audit.name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Атомарно переводить замовлення в 'ready' (terminal) та створює N транзакцій
 * income (по одній на кожну позицію order.items[]). Поле deliveredAt
 * залишилось як історична назва — семантично це "дата завершення".
 * Повертає список ID нових транзакцій.
 */
export async function completeOrder(
  order: Order,
  completionDate: Date,
  uid?: string
): Promise<string[]> {
  if (!order.items || order.items.length === 0) {
    throw new Error("Замовлення без позицій неможливо завершити");
  }

  const audit = currentAudit();
  const createdBy = uid || audit.uid;
  const createdByName = audit.name;
  const batch = writeBatch(firebase.db);
  const txCollection = collection(firebase.db, "transactions");
  const txTs = Timestamp.fromDate(completionDate);
  const ts = serverTimestamp();
  const newTxIds: string[] = [];

  for (const item of order.items) {
    const txRef = doc(txCollection);
    newTxIds.push(txRef.id);
    batch.set(txRef, {
      date: txTs,
      type: "income",
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      productId: item.productId,
      productName: item.productName,
      supplierId: null,
      supplierName: null,
      customerId: order.customerId,
      customerName: order.customerName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      totalAmount: item.totalAmount,
      note: order.notes ?? null,
      orderId: order.id,
      createdBy,
      createdByName,
      updatedBy: createdBy,
      updatedByName: createdByName,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  // Платна доставка → окрема income/expense транзакція у категорії "Доставка".
  const dCost = order.delivery?.cost ?? null;
  const dPaidBy = order.delivery?.paidBy ?? null;
  if (dCost && dCost > 0 && dPaidBy) {
    const txType: TransactionType =
      dPaidBy === "customer" ? "income" : "expense";
    const cat = await resolveDeliveryCategory(
      txType,
      batch,
      ts,
      createdBy,
      createdByName
    );
    const txRef = doc(txCollection);
    newTxIds.push(txRef.id);
    batch.set(txRef, {
      date: txTs,
      type: txType,
      categoryId: cat.id,
      categoryName: cat.name,
      productId: null,
      productName: "Доставка",
      supplierId: null,
      supplierName: null,
      customerId: dPaidBy === "customer" ? order.customerId : null,
      customerName: dPaidBy === "customer" ? order.customerName : null,
      unitPrice: dCost,
      quantity: 1,
      totalAmount: dCost,
      note: order.delivery?.trackingNumber
        ? `ТТН: ${order.delivery.trackingNumber}`
        : null,
      orderId: order.id,
      createdBy,
      createdByName,
      updatedBy: createdBy,
      updatedByName: createdByName,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  batch.update(doc(firebase.db, COLLECTION, order.id), {
    status: "ready" as OrderStatus,
    deliveredAt: txTs,
    transactionIds: newTxIds,
    // Завершене замовлення вважається оплаченим. Спосіб лишаємо, якщо вже був.
    paymentStatus: "paid" as PaymentStatus,
    paymentMethod: order.paymentMethod ?? null,
    updatedBy: createdBy,
    updatedByName: createdByName,
    updatedAt: ts,
  });

  await batch.commit();

  // Авто-списання зі складу — best-effort ПІСЛЯ коміту: сумуємо кількість по
  // кожному товару (позиція може повторюватись) і зменшуємо залишок. Окремо від
  // batch, щоб посилання на видалений товар не зривало завершення замовлення.
  const stockByProduct = new Map<string, number>();
  for (const item of order.items) {
    if (!item.productId || item.quantity <= 0) continue;
    stockByProduct.set(
      item.productId,
      (stockByProduct.get(item.productId) ?? 0) + item.quantity
    );
  }
  for (const [productId, qty] of stockByProduct) {
    adjustStock(productId, -qty).catch((e) =>
      console.warn("adjustStock failed", productId, e)
    );
  }

  // Сповіщення про зміну статусу — fire-and-forget, не блокує повернення.
  if (order.status !== "ready") {
    notifyOrderStatusChange({
      orderId: order.id,
      customerName: order.customerName,
      changedByName: createdByName,
      fromStatus: order.status,
      toStatus: "ready",
    }).catch((e) => console.warn("notifyOrderStatusChange failed", e));
  }

  return newTxIds;
}

const DELIVERY_CATEGORY_COLOR = "#6366f1"; // indigo — нейтральний для "Доставка"

/**
 * Знаходить категорію "Доставка" заданого типу (income/expense). Якщо відсутня —
 * створює нову у тому ж batch, повертає id+name.
 */
async function resolveDeliveryCategory(
  type: TransactionType,
  batch: ReturnType<typeof writeBatch>,
  ts: ReturnType<typeof serverTimestamp>,
  createdBy: string,
  createdByName: string | null
): Promise<{ id: string; name: string }> {
  const snap = await getDocs(
    query(collection(firebase.db, "categories"), where("type", "==", type))
  );
  const target = snap.docs.find(
    (d) => (d.data() as Category).name.trim().toLowerCase() === "доставка"
  );
  if (target) {
    const data = target.data() as Category;
    return { id: target.id, name: data.name };
  }
  const ref = doc(collection(firebase.db, "categories"));
  batch.set(ref, {
    name: "Доставка",
    type,
    color: DELIVERY_CATEGORY_COLOR,
    sortOrder: 999,
    createdBy,
    createdByName,
    updatedBy: createdBy,
    updatedByName: createdByName,
    createdAt: ts,
    updatedAt: ts,
  });
  return { id: ref.id, name: "Доставка" };
}

export async function deleteOrder(id: string): Promise<void> {
  await deleteDoc(doc(firebase.db, COLLECTION, id));
}
