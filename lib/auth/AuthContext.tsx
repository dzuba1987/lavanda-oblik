"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { ensureUserDoc, getUserDoc, touchUserPresence } from "@/lib/data/users";
import type { UserDoc } from "@/lib/data/types";

const PRESENCE_INTERVAL_MS = 60_000;

type AuthState = {
  loading: boolean;
  authUser: User | null;
  userDoc: UserDoc | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    name: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userDoc, setUserDocState] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Передає ФІО з форми реєстрації в listener — щоб ensureUserDoc створювався
  // одним шляхом і ім'я гарантовано потрапило у документ.
  const pendingNameRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebase.auth, async (user) => {
      if (user) {
        // Скидаємо stale userDoc, щоб AppLayout не флешнув кабінет старого юзера
        // поки крутиться await ensureUserDoc для нового.
        setLoading(true);
        setUserDocState(null);
        setAuthUser(user);
        try {
          const pendingName = pendingNameRef.current;
          if (pendingName && (user.displayName ?? "") !== pendingName) {
            try {
              await updateProfile(user, { displayName: pendingName });
            } catch (e) {
              console.warn("updateProfile failed", e);
            }
          }
          const ud = await ensureUserDoc(user, pendingName);
          pendingNameRef.current = null;
          setUserDocState(ud);
        } catch (e) {
          console.error("ensureUserDoc failed", e);
          setUserDocState(null);
        }
      } else {
        setAuthUser(null);
        setUserDocState(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Presence heartbeat — оновлює users/{uid}.lastSeenAt поки відкритий таб.
  // Skip коли вкладка прихована — не засмічуємо writes у Firestore коли користувач
  // переключився, але session жива.
  useEffect(() => {
    if (!authUser) return;
    const uid = authUser.uid;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      touchUserPresence(uid);
    };

    tick();
    const id = window.setInterval(tick, PRESENCE_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authUser]);

  const value: AuthState = {
    loading,
    authUser,
    userDoc,
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(firebase.auth, provider);
    },
    async signInWithEmail(email, password) {
      await signInWithEmailAndPassword(firebase.auth, email, password);
    },
    async signUpWithEmail(email, password, name) {
      pendingNameRef.current = name.trim() || null;
      try {
        await createUserWithEmailAndPassword(firebase.auth, email, password);
      } catch (e) {
        pendingNameRef.current = null;
        throw e;
      }
    },
    async signOut() {
      await fbSignOut(firebase.auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export async function getCurrentUserDoc(): Promise<UserDoc | null> {
  const u = firebase.auth.currentUser;
  if (!u) return null;
  return getUserDoc(u.uid);
}
