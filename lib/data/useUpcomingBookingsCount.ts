"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Booking } from "./types";

/**
 * Кількість активних записів на фотосесії — для бейджа в навігації.
 * «Активний» = майбутній (start >= початок сьогодні) і не скасований/завершений,
 * тобто статус 'tentative' або 'confirmed'. Range-фільтр по start робимо у
 * Firestore, статус — на клієнті (щоб не плодити композитні індекси).
 * Real-time через onSnapshot. Поза admin-роллю одразу 0 (rules не дадуть read).
 */
export function useUpcomingBookingsCount(): number {
  const { authUser, userDoc } = useAuth();
  const allowed = !!authUser && userDoc?.role === "admin";
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const q = query(
      collection(firebase.db, "bookings"),
      where("start", ">=", Timestamp.fromDate(startOfToday))
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let n = 0;
        snap.forEach((d) => {
          const status = (d.data() as Booking).status;
          if (status === "tentative" || status === "confirmed") n++;
        });
        setCount(n);
      },
      (err) => {
        console.warn("useUpcomingBookingsCount snapshot error", err);
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
