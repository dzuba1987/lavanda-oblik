import { orderBy } from "firebase/firestore";
import { makeCrud } from "./crud";
import type { Category } from "./types";

export const categoriesCrud = makeCrud<Omit<Category, "id">>(
  "categories",
  [orderBy("type"), orderBy("sortOrder"), orderBy("name")]
);

export const DEFAULT_CATEGORY_COLORS = [
  "#7c5cbb", // фіолетовий
  "#22c55e", // зелений
  "#ef4444", // червоний
  "#f59e0b", // жовтий
  "#0ea5e9", // блакитний
  "#ec4899", // рожевий
  "#14b8a6", // бірюзовий
  "#a855f7", // пурпуровий
];
