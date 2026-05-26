import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
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
  const ref = await addDoc(col(orderId), {
    text,
    authorUid,
    authorName,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteComment(
  orderId: string,
  commentId: string
): Promise<void> {
  await deleteDoc(doc(firebase.db, "orders", orderId, "comments", commentId));
}
