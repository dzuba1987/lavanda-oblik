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
  /** Сповіщати про новий запис на фотосесію. Undefined трактуємо як увімкнено. */
  notifyNewBooking?: boolean;
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
  /**
   * Поточний залишок на складі. Зменшується автоматично при продажах
   * (income-транзакція або завершення замовлення з цим товаром).
   * Може стати від'ємним при перепродажу — UI підсвічує це.
   * Optional: товари, створені до фічі складу, не мають поля → трактуємо як 0.
   */
  stock?: number;
  /** Ціна закупівлі (собівартість) за одиницю. null = не вказано. */
  costPrice?: number | null;
  /** Довільні нотатки до позиції складу. */
  notes?: string | null;
  /**
   * Фото товару — inline JPEG як data URL (base64), без Firebase Storage.
   * Ресайз до 800px + JPEG q0.7 (~30-80КБ), щоб влізти в ліміт документа (1MB).
   * null/undefined = фото немає.
   */
  photo?: string | null;
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

export type BookingStatus = "tentative" | "confirmed" | "done" | "cancelled";

/**
 * Запис на фотосесію. Зберігається в колекції "bookings".
 * `start` — момент початку (дата+час), `durationMin` — тривалість у хвилинах;
 * кінець обчислюється на льоту. customerId опційний (новий клієнт може бути
 * вписаний вручну без картки в "customers"); customerName денормалізований
 * для відображення без додаткового читання.
 */
export interface Booking extends AuditFields {
  id: string;
  customerId: string | null;
  customerName: string;
  phone: string | null;
  start: Timestamp;
  durationMin: number;
  status: BookingStatus;
  /** Тип зйомки (Портрет, Сімейна…) — вільний текст. */
  type: string | null;
  price: number | null;
  /** Статус оплати. Optional: записи до фічі трактуємо як "unpaid". */
  paymentStatus?: PaymentStatus;
  /** Спосіб оплати — актуальний лише коли paymentStatus === "paid". */
  paymentMethod?: PaymentMethod | null;
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
  /** Зібране — готове до видачі, але ще не віддане клієнту (без транзакцій). */
  | "assembled"
  /** Terminal: при переході сюди створюються транзакції income. */
  | "ready";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "assembled",
  "ready",
];

/** Активні (в роботі) — без ready, бо ready тепер закриває замовлення. */
export const ORDER_ACTIVE_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "assembled",
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

/** Статус оплати замовлення. */
export type PaymentStatus = "unpaid" | "paid";

/** Спосіб оплати. Актуальний лише коли paymentStatus === "paid". */
export type PaymentMethod = "cash" | "card";

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
  /**
   * Статус оплати. Старі замовлення без цього поля трактуються як "unpaid".
   */
  paymentStatus: PaymentStatus;
  /** Спосіб оплати; null поки замовлення не оплачено. */
  paymentMethod: PaymentMethod | null;
  createdBy: string;
  createdByName?: string | null;
  updatedBy?: string;
  updatedByName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deliveredAt: Timestamp | null;
}
