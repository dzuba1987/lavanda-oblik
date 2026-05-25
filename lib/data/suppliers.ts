import { orderBy } from "firebase/firestore";
import { makeCrud } from "./crud";
import type { Supplier } from "./types";

export const suppliersCrud = makeCrud<Omit<Supplier, "id">>("suppliers", [
  orderBy("name"),
]);
