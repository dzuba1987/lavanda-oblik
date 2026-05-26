import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getFirebase() {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK cannot run on the server");
  }

  if (!_app) {
    _app = getApps()[0] ?? initializeApp(firebaseConfig);

    // App Check (захист Firebase AI Logic та інших API від несанкціонованих клієнтів).
    // Ініціалізуємо ДО getAuth/initializeFirestore — інакше токен не прикріпиться.
    // Якщо env не заданий — пропускаємо (locally / без AI можна жити без App Check).
    const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (recaptchaKey) {
      // У дев-режимі вмикаємо debug-токен (Firebase запише його в console — додай
      // у Firebase Console → App Check → Apps → Manage debug tokens).
      if (process.env.NODE_ENV !== "production") {
        (
          self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }
        ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      try {
        initializeAppCheck(_app, {
          provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (e) {
        console.warn("App Check init failed:", e);
      }
    }

    _auth = getAuth(_app);
    _db = initializeFirestore(_app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
      connectAuthEmulator(_auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(_db, "127.0.0.1", 8080);
    }
  }

  return { app: _app, auth: _auth!, db: _db! };
}

export const firebase = {
  get app() {
    return getFirebase().app;
  },
  get auth() {
    return getFirebase().auth;
  },
  get db() {
    return getFirebase().db;
  },
};
