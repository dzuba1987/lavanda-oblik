"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Кількість замовлень у статусі "new" — для бейджа в навігації.
 * Підписується через onSnapshot, тому оновлюється у реальному часі.
 * Поза admin-роллю одразу повертає 0 (Firestore rules не дадуть read).
 */
export function useNewOrdersCount(): number {
  const { authUser, userDoc } = useAuth();
  const allowed = !!authUser && userDoc?.role === "admin";
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    const q = query(
      collection(firebase.db, "orders"),
      where("status", "==", "new")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      (err) => {
        console.warn("useNewOrdersCount snapshot error", err);
        setCount(0);
      }
    );
    return () => {
      unsub();
      setCount(0);
    };
  }, [allowed]);

  return allowed ? count : 0;
}
