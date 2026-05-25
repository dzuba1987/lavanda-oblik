import {
  collection,
  doc,
  getDocs,
  addDoc,
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
import type { Order, OrderItem, OrderStatus } from "./types";

const COLLECTION = "orders";

export type OrderInput = {
  customerId: string | null;
  customerName: string | null;
  items: OrderItem[];
  totalAmount: number;
  deadline: Date | null;
  status: OrderStatus;
  notes: string | null;
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

export async function createOrder(
  input: OrderInput,
  uid: string
): Promise<string> {
  const ref = await addDoc(col(), {
    customerId: input.customerId,
    customerName: input.customerName,
    items: input.items,
    totalAmount: input.totalAmount,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    status: input.status,
    notes: input.notes,
    transactionIds: [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deliveredAt: null,
  });
  return ref.id;
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
