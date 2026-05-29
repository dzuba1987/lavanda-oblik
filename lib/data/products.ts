import { doc, increment, orderBy, updateDoc } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { makeCrud } from "./crud";
import type { Product } from "./types";

export const productsCrud = makeCrud<Omit<Product, "id">>("products", [
  orderBy("name"),
]);

/**
 * Атомарно коригує залишок товару на `delta` (від'ємне — списання, додатнє —
 * поповнення). Використовує Firestore increment, тож безпечне для конкурентних
 * записів. Не чіпає інші поля документа.
 */
export async function adjustStock(
  productId: string,
  delta: number
): Promise<void> {
  if (!delta) return;
  await updateDoc(doc(firebase.db, "products", productId), {
    stock: increment(delta),
  });
}

export const COMMON_UNITS = [
  "шт",
  "мл",
  "л",
  "г",
  "кг",
  "м",
  "пак.",
  "наб.",
  "люд.",
];
