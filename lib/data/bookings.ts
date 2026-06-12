import { orderBy } from "firebase/firestore";
import { makeCrud } from "./crud";
import type { Booking } from "./types";

/**
 * CRUD для записів на фотосесії. Сортування за часом початку (asc) —
 * зручно для рендеру таймлайну. Обсяг даних малий (один фотограф),
 * тому сторінка вантажить усі записи й фільтрує день/місяць на клієнті.
 */
export const bookingsCrud = makeCrud<Omit<Booking, "id">>("bookings", [
  orderBy("start", "asc"),
]);
