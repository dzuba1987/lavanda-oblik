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
import type { Delivery, Order, OrderItem, OrderStatus } from "./types";

const COLLECTION = "orders";

export type OrderInput = {
  customerId: string | null;
  customerName: string | null;
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
  uid: string,
  createdByName: string | null = null
): Promise<void> {
  await setDoc(doc(firebase.db, COLLECTION, id), {
    customerId: input.customerId,
    customerName: input.customerName,
    items: input.items,
    totalAmount: input.totalAmount,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    status: input.status,
    notes: input.notes,
    photos: input.photos,
    delivery: input.delivery,
    transactionIds: [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    customerId: input.customerId,
    customerName: input.customerName,
    items: input.items,
    totalAmount: input.totalAmount,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    status: input.status,
    notes: input.notes,
    photos: input.photos,
    delivery: input.delivery,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Простий перехід статусу без створення транзакцій.
 * Для переходу в 'delivered' використовуйте deliverOrder.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<void> {
  if (status === "delivered") {
    throw new Error(
      "Для переходу в 'delivered' використовуйте deliverOrder — він створює транзакції"
    );
  }
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Атомарно переводить замовлення в 'delivered' та створює N транзакцій income
 * (по одній на кожну позицію order.items[]).
 * Повертає список ID нових транзакцій.
 */
export async function deliverOrder(
  order: Order,
  deliveryDate: Date,
  uid: string
): Promise<string[]> {
  if (!order.items || order.items.length === 0) {
    throw new Error("Замовлення без позицій неможливо видати");
  }

  const batch = writeBatch(firebase.db);
  const txCollection = collection(firebase.db, "transactions");
  const txTs = Timestamp.fromDate(deliveryDate);
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
      createdBy: uid,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  batch.update(doc(firebase.db, COLLECTION, order.id), {
    status: "delivered" as OrderStatus,
    deliveredAt: txTs,
    transactionIds: newTxIds,
    updatedAt: ts,
  });

  await batch.commit();
  return newTxIds;
}

export async function deleteOrder(id: string): Promise<void> {
  await deleteDoc(doc(firebase.db, COLLECTION, id));
}
