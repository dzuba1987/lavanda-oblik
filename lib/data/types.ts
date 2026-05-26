import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "seller" | "viewer";

/**
 * Спільні audit-поля для всіх документів — щоб бачити "хто додавав/змінював".
 * Старі записи (до впровадження) не мають цих полів — рендер має толерувати undefined.
 */
export interface AuditFields {
  createdBy?: string;
  createdByName?: string | null;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedByName?: string | null;
  updatedAt?: Timestamp;
}

export interface UserDoc {
  uid: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Timestamp;
  /** Telegram chat ID, заповнюється коли користувач прив'язує Telegram. */
  telegramChatId?: string | null;
  /** Останній heartbeat від клієнта (кожні 60с). null = ще ніколи не входив. */
  lastSeenAt?: Timestamp;
}

export interface TelegramSettings {
  /** chatId головного адміна, на який дублюються alert'и про нових юзерів. */
  chatId: string;
  notifyNewUser: boolean;
  notifyNewOrder: boolean;
  /** Сповіщати про зміну статусу замовлення (хто, з якого на який). */
  notifyOrderStatus?: boolean;
}

export type TransactionType = "income" | "expense";

export interface Category extends AuditFields {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  sortOrder: number;
}

export interface Product extends AuditFields {
  id: string;
  name: string;
  unit: string;
  defaultPrice: number | null;
  defaultCategoryId: string | null;
}

export interface Supplier extends AuditFields {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
}

export interface Customer extends AuditFields {
  id: string;
  name: string;
  age: number | null;
  source: string | null;
  /** Телефон у вільному форматі — використовується для tel: link. */
  phone: string | null;
  /**
   * Звичайна адреса клієнта (вулиця, місто). Використовується як дефолт
   * для delivery.address у нових замовленнях. Окремих координат не зберігаємо —
   * навігація відкривається у зовнішніх картах по тексту адреси.
   *
   * Optional: старі клієнти створені до фічі не мають цього поля.
   */
  address?: string | null;
  notes: string | null;
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
  createdByName?: string | null;
  updatedBy?: string;
  updatedByName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OrderStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  /** Terminal: при переході сюди створюються транзакції income. */
  | "ready";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "ready",
];

/** Активні (в роботі) — без ready, бо ready тепер закриває замовлення. */
export const ORDER_ACTIVE_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
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

/** Хто оплачує доставку: клієнт (→ income) чи ми (→ expense). */
export type DeliveryPaidBy = "customer" | "us";

export interface Delivery {
  method: DeliveryMethod;
  /** ТТН / номер відправлення (для НП, Укрпошти, Meest). */
  trackingNumber: string | null;
  /** Адреса доставки, № відділення або довільний опис. */
  address: string | null;
  /**
   * Вартість доставки. null / 0 = безкоштовна або не вказана.
   * При completeOrder, якщо > 0 і paidBy заданий — створюється окрема
   * транзакція income (customer) або expense (us) у категорії "Доставка".
   */
  cost?: number | null;
  paidBy?: DeliveryPaidBy | null;
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
  /** Контактний телефон для саме цього замовлення (може відрізнятись від клієнтового). */
  phone: string | null;
  items: OrderItem[];
  totalAmount: number;
  deadline: Timestamp | null;
  status: OrderStatus;
  notes: string | null;
  /**
   * Денормалізований лічильник коментарів. Інкрементується при addComment,
   * декрементується при deleteComment. Дозволяє показувати індикатор у списку
   * без N+1 запитів до subcollection.
   */
  commentsCount: number;
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
  createdByName?: string | null;
  updatedBy?: string;
  updatedByName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deliveredAt: Timestamp | null;
}
