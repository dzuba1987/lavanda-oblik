import { orderBy } from "firebase/firestore";
import { makeCrud } from "./crud";
import type { Product } from "./types";

export const productsCrud = makeCrud<Omit<Product, "id">>("products", [
  orderBy("name"),
]);

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
