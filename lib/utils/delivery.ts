import type { DeliveryMethod } from "@/lib/data/types";

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  nova_poshta: "Нова Пошта",
  ukrposhta: "Укрпошта",
  meest: "Meest Express",
  courier: "Кур'єр",
  self_pickup: "Самовивіз",
  other: "Інше",
};

/** Чи метод доставки використовує ТТН (підтримує трекінг). */
export function hasTracking(method: DeliveryMethod): boolean {
  return method === "nova_poshta" || method === "ukrposhta" || method === "meest";
}

/**
 * Повертає URL для трекінгу ТТН на сайті відповідного перевізника,
 * або null якщо метод без трекінгу або ТТН відсутній.
 */
export function trackingUrl(
  method: DeliveryMethod,
  trackingNumber: string | null
): string | null {
  if (!trackingNumber) return null;
  const ttn = trackingNumber.trim();
  if (!ttn) return null;

  switch (method) {
    case "nova_poshta":
      return `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`;
    case "ukrposhta":
      return `https://track.ukrposhta.ua/tracking_UA.html?barcode=${encodeURIComponent(ttn)}`;
    case "meest":
      return `https://meest-group.com/ua/tracking/${encodeURIComponent(ttn)}`;
    default:
      return null;
  }
}
