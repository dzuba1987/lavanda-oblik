import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { OrderComment } from "./types";

function col(orderId: string) {
  return collection(firebase.db, "orders", orderId, "comments");
}

export async function listComments(orderId: string): Promise<OrderComment[]> {
  const snap = await getDocs(query(col(orderId), orderBy("createdAt", "asc")));
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<OrderComment, "id">) })
  );
}

export async function addComment(
  orderId: string,
  text: string,
  authorUid: string,
  authorName: string | null
): Promise<string> {
  const batch = writeBatch(firebase.db);
  const commentRef = doc(col(orderId));
  batch.set(commentRef, {
    text,
    authorUid,
    authorName,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(firebase.db, "orders", orderId), {
    commentsCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return commentRef.id;
}

export async function deleteComment(
  orderId: string,
  commentId: string
): Promise<void> {
  const batch = writeBatch(firebase.db);
  batch.delete(doc(firebase.db, "orders", orderId, "comments", commentId));
  batch.update(doc(firebase.db, "orders", orderId), {
    commentsCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Backfill для старих замовлень, де commentsCount ще немає у документі.
 * Викликається вручну з dev-екрану, не у звичайному flow.
 */
export async function recountComments(orderId: string): Promise<number> {
  const snap = await getDocs(col(orderId));
  const n = snap.size;
  await updateDoc(doc(firebase.db, "orders", orderId), {
    commentsCount: n,
    updatedAt: serverTimestamp(),
  });
  return n;
}
