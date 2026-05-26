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
import { currentAudit } from "./audit";

export type WithId<T> = T & { id: string };

/**
 * Generic CRUD-фабрика для будь-якої Firestore-колекції.
 * Автоматично проставляє audit-поля (createdBy/Name, updatedBy/Name, createdAt, updatedAt).
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
      const { uid, name } = currentAudit();
      const ts = serverTimestamp();
      const ref = await addDoc(col(), {
        ...data,
        createdBy: uid,
        createdByName: name,
        updatedBy: uid,
        updatedByName: name,
        createdAt: ts,
        updatedAt: ts,
      });
      return ref.id;
    },

    async update(id: string, data: Partial<T>): Promise<void> {
      const { uid, name } = currentAudit();
      await updateDoc(doc(firebase.db, collectionName, id), {
        ...data,
        updatedBy: uid,
        updatedByName: name,
        updatedAt: serverTimestamp(),
      } as DocumentData);
    },

    async remove(id: string): Promise<void> {
      await deleteDoc(doc(firebase.db, collectionName, id));
    },
  };
}
