import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "seller" | "viewer";

export interface UserDoc {
  uid: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Timestamp;
  /** Telegram chat ID, заповнюється коли користувач прив'язує Telegram. */
  telegramChatId?: string | null;
}

export interface TelegramSettings {
  /** chatId головного адміна, на який дублюються alert'и про нових юзерів. */
  chatId: string;
  notifyNewUser: boolean;
  notifyNewOrder: boolean;
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
  /** Якщо транзакцію створено з замовлення — посилання на нього. */
  orderId?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OrderStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
];

export const ORDER_ACTIVE_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "ready",
];

export interface OrderItem {
  productId: string | null;
  productName: string;
  categoryId: string;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
}

export const ORDER_PHOTOS_MAX = 5;

export type DeliveryMethod =
  | "nova_poshta"
  | "ukrposhta"
  | "meest"
  | "courier"
  | "self_pickup"
  | "other";

export const DELIVERY_METHODS: DeliveryMethod[] = [
  "nova_poshta",
  "ukrposhta",
  "meest",
  "courier",
  "self_pickup",
  "other",
];

export interface Delivery {
  method: DeliveryMethod;
  /** ТТН / номер відправлення (для НП, Укрпошти, Meest). */
  trackingNumber: string | null;
  /** Адреса доставки, № відділення або довільний опис. */
  address: string | null;
}

export interface OrderComment {
  id: string;
  text: string;
  authorUid: string;
  authorName: string | null;
  createdAt: Timestamp;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string | null;
  items: OrderItem[];
  totalAmount: number;
  deadline: Timestamp | null;
  status: OrderStatus;
  notes: string | null;
  /** ID транзакцій, створених при переході в delivered. */
  transactionIds: string[];
  /**
   * Inline JPEG-фото у вигляді data URL (base64). Зберігаються в самому
   * документі замовлення — без Firebase Storage.
   * Через ліміт документа Firestore (1MB) кожне фото має бути компактним:
   * ресайз до 800px + JPEG q=0.7 (~30-80КБ). Максимум {@link ORDER_PHOTOS_MAX}.
   */
  photos: string[];
  /** Інформація про доставку. null = не вказано. */
  delivery: Delivery | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deliveredAt: Timestamp | null;
}
