import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  limit,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import type { Role, UserDoc } from "./types";
import { notifyNewUser } from "@/lib/notify/telegram";

const USERS = "users";

export async function listUsers(): Promise<UserDoc[]> {
  const snap = await getDocs(
    query(collection(firebase.db, USERS), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as Omit<UserDoc, "uid">),
  }));
}

export async function updateUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(firebase.db, USERS, uid), { role });
}

export async function deleteUserDoc(uid: string): Promise<void> {
  await deleteDoc(doc(firebase.db, USERS, uid));
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(firebase.db, USERS, uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UserDoc, "uid">) };
}

/**
 * Створює або оновлює users/{uid} під час входу.
 * Перший користувач у системі отримує role='admin'.
 * Решта — 'viewer' (адмін підвищує вручну з UI пізніше).
 *
 * `nameOverride` потрібен для email-signup: на момент створення документа
 * Firebase ще не встиг прокинути displayName з updateProfile у authUser об'єкт.
 */
export async function ensureUserDoc(
  authUser: User,
  nameOverride?: string | null
): Promise<UserDoc> {
  const existing = await getUserDoc(authUser.uid);
  if (existing) return existing;

  const anyUsersSnap = await getDocs(
    query(collection(firebase.db, USERS), limit(1))
  );
  const role: Role = anyUsersSnap.empty ? "admin" : "viewer";

  const resolvedName =
    (nameOverride && nameOverride.trim()) || authUser.displayName || null;

  const payload = {
    email: authUser.email ?? "",
    name: resolvedName,
    role,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(firebase.db, USERS, authUser.uid), payload);
  const fresh = await getUserDoc(authUser.uid);
  if (!fresh) throw new Error("Не вдалось створити запис користувача");

  // Перший адмін системи сам себе підтверджує — сповіщати нікого.
  if (role !== "admin") {
    notifyNewUser({
      uid: fresh.uid,
      name: fresh.name,
      email: fresh.email,
    }).catch((e) => console.warn("notifyNewUser failed", e));
  }

  return fresh;
}
