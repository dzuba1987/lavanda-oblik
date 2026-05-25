import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "seller" | "viewer";

export interface UserDoc {
  uid: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Timestamp;
}

export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  sortOrder: number;
  createdAt: Timestamp;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  defaultPrice: number | null;
  defaultCategoryId: string | null;
  createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  createdAt: Timestamp;
}

export interface Customer {
  id: string;
  name: string;
  age: number | null;
  source: string | null;
  notes: string | null;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  date: Timestamp;
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
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
