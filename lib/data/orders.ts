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
import { notifyNewOrder } from "@/lib/notify/telegram";
import { formatDate } from "@/lib/utils/format";
import { currentAudit } from "./audit";
import type { Delivery, Order, OrderItem, OrderStatus } from "./types";

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
    updatedBy: audit.uid,
    updatedByName: audit.name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Простий перехід статусу без створення транзакцій.
 * Для переходу в 'ready' (terminal) використовуйте completeOrder.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<void> {
  if (status === "ready") {
    throw new Error(
      "Для переходу в 'ready' використовуйте completeOrder — він створює транзакції"
    );
  }
  const audit = currentAudit();
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    status,
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

  batch.update(doc(firebase.db, COLLECTION, order.id), {
    status: "ready" as OrderStatus,
    deliveredAt: txTs,
    transactionIds: newTxIds,
    updatedBy: createdBy,
    updatedByName: createdByName,
    updatedAt: ts,
  });

  await batch.commit();
  return newTxIds;
}

export async function deleteOrder(id: string): Promise<void> {
  await deleteDoc(doc(firebase.db, COLLECTION, id));
}
