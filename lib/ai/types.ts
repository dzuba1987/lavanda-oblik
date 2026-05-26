import type { DeliveryMethod } from "@/lib/data/types";

/** Один пункт замовлення, як його розпарсила AI. id=null = не знайдено в довіднику. */
export type ParsedItem = {
  productName: string;
  productId: string | null;
  categoryName: string;
  categoryId: string | null;
  quantity: number;
  unitPrice: number;
};

/** Кандидат на існуючого клієнта з fuzzy-матчингу. score 0..1, менше = краще (Fuse). */
export type ParsedCustomerCandidate = {
  id: string;
  name: string;
  score: number;
};

export type ParsedDelivery = {
  method: DeliveryMethod | null;
  cost: number | null;
  paidBy: "customer" | "us" | null;
  /** ТТН / номер відправлення якщо було згадано. */
  trackingNumber: string | null;
  /** Адреса якщо була озвучена окремо. */
  address: string | null;
};

/**
 * Результат парсингу голосового замовлення. Не пишеться в Firestore безпосередньо
 * — спершу прев'ю-форма OrderForm, де користувач підтверджує/виправляє поля.
 */
export type ParsedOrder = {
  transcript: string;
  /** Сире імʼя клієнта з фрази ("Олі", "замовлення для Вінниці"). */
  customerName: string | null;
  /** Топ-3 fuzzy-match кандидати з існуючих клієнтів. Може бути порожньо. */
  customerCandidates: ParsedCustomerCandidate[];
  items: ParsedItem[];
  delivery: ParsedDelivery | null;
  notes: string | null;
};
