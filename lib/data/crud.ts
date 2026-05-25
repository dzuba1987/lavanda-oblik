import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";

export type WithId<T> = T & { id: string };

/**
 * Generic CRUD-фабрика для будь-якої Firestore-колекції.
 */
export function makeCrud<T extends DocumentData>(
  collectionName: string,
  defaultOrder: QueryConstraint[] = [orderBy("createdAt", "desc")]
) {
  const col = () => collection(firebase.db, collectionName);

  return {
    async list(extra: QueryConstraint[] = []): Promise<WithId<T>[]> {
      const q = query(col(), ...defaultOrder, ...extra);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
    },

    async create(data: Omit<T, "createdAt">): Promise<string> {
      const ref = await addDoc(col(), {
        ...data,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },

    async update(id: string, data: Partial<T>): Promise<void> {
      await updateDoc(doc(firebase.db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp(),
      } as DocumentData);
    },

    async remove(id: string): Promise<void> {
      await deleteDoc(doc(firebase.db, collectionName, id));
    },
  };
}
