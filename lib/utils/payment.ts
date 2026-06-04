import type { Order, PaymentMethod, PaymentStatus } from "@/lib/data/types";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Готівка",
  card: "Картка",
};

/** Чи оплачене замовлення за полем статусу. Старі без поля → не оплачено. */
export function isPaid(status: PaymentStatus | null | undefined): boolean {
  return status === "paid";
}

/**
 * Ефективний статус оплати замовлення.
 * - явне "paid" → оплачено;
 * - явне "unpaid" → не оплачено (поважаємо ручне зняття оплати навіть для ready);
 * - поле відсутнє (старі дані) → ready вважається оплаченим автоматично.
 */
export function isOrderPaid(
  order: Pick<Order, "paymentStatus" | "status">
): boolean {
  if (order.paymentStatus === "paid") return true;
  if (order.paymentStatus === "unpaid") return false;
  return order.status === "ready";
}

/**
 * Текст бейджа оплати: «Оплачено · готівка» / «Оплачено · картка» /
 * «Оплачено» (спосіб невідомий) / «Не оплачено».
 */
export function orderPaymentLabel(
  order: Pick<Order, "paymentStatus" | "status" | "paymentMethod">
): string {
  if (isOrderPaid(order)) {
    return order.paymentMethod
      ? `Оплачено · ${PAYMENT_METHOD_LABEL[order.paymentMethod].toLowerCase()}`
      : "Оплачено";
  }
  return "Не оплачено";
}
