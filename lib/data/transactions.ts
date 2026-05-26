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
  type QueryConstraint,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { currentAudit } from "./audit";
import type { Transaction, TransactionType } from "./types";

const COLLECTION = "transactions";

export type TransactionInput = {
  date: Date;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  productId: string | null;
  productName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  customerId: string | null;
  customerName: string | null;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  note: string | null;
};

export type TransactionFilter = {
  type?: TransactionType;
  categoryId?: string;
  from?: Date;
  to?: Date;
};

function col() {
  return collection(firebase.db, COLLECTION);
}

export async function listTransactions(
  filter: TransactionFilter = {}
): Promise<Transaction[]> {
  const constraints: QueryConstraint[] = [];
  if (filter.type) constraints.push(where("type", "==", filter.type));
  if (filter.categoryId)
    constraints.push(where("categoryId", "==", filter.categoryId));
  if (filter.from)
    constraints.push(where("date", ">=", Timestamp.fromDate(filter.from)));
  if (filter.to)
    constraints.push(where("date", "<=", Timestamp.fromDate(filter.to)));
  constraints.push(orderBy("date", "desc"));

  const snap = await getDocs(query(col(), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
}

export async function createTransaction(
  input: TransactionInput,
  uid?: string
): Promise<string> {
  const audit = currentAudit();
  const createdBy = uid || audit.uid;
  const ts = serverTimestamp();
  const ref = await addDoc(col(), {
    ...input,
    date: Timestamp.fromDate(input.date),
    createdBy,
    createdByName: audit.name,
    updatedBy: createdBy,
    updatedByName: audit.name,
    createdAt: ts,
    updatedAt: ts,
  });
  return ref.id;
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<void> {
  const audit = currentAudit();
  await updateDoc(doc(firebase.db, COLLECTION, id), {
    ...input,
    date: Timestamp.fromDate(input.date),
    updatedBy: audit.uid,
    updatedByName: audit.name,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(firebase.db, COLLECTION, id));
}
