"use client";

import {
  createContext,
  useContext,
  useEffect,
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
  type User,
} from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { ensureUserDoc, getUserDoc } from "@/lib/data/users";
import type { UserDoc } from "@/lib/data/types";

type AuthState = {
  loading: boolean;
  authUser: User | null;
  userDoc: UserDoc | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userDoc, setUserDocState] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebase.auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const ud = await ensureUserDoc(user);
          setUserDocState(ud);
        } catch (e) {
          console.error("ensureUserDoc failed", e);
          setUserDocState(null);
        }
      } else {
        setUserDocState(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
    async signUpWithEmail(email, password) {
      const cred = await createUserWithEmailAndPassword(
        firebase.auth,
        email,
        password
      );
      await ensureUserDoc(cred.user);
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
