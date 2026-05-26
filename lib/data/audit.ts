import { firebase } from "@/lib/firebase/client";

/**
 * Поточний користувач у форматі, придатному для audit-полів у документах.
 * Якщо користувача нема (нелогічно — пишемо тільки залогінені) — повертаємо порожні значення.
 */
export function currentAudit(): { uid: string; name: string | null } {
  const u = firebase.auth.currentUser;
  if (!u) return { uid: "", name: null };
  return {
    uid: u.uid,
    name: u.displayName?.trim() || null,
  };
}
