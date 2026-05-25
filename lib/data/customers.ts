import { orderBy } from "firebase/firestore";
import { makeCrud } from "./crud";
import type { Customer } from "./types";

export const customersCrud = makeCrud<Omit<Customer, "id">>("customers", [
  orderBy("name"),
]);
