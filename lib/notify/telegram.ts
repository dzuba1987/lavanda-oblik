/**
 * Telegram-сповіщення через Laravel-бекенд `invest-notify` (endpoints під
 * `/api/lavanda/telegram/*`). Frontend ніколи не звертається до Telegram Bot
 * API напряму — секрет токен лежить лише на бекенді.
 *
 * Усі виклики "fire-and-forget": помилка мережі не повинна заблокувати
 * створення замовлення чи реєстрацію користувача.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { TelegramSettings } from "@/lib/data/types";

const API_BASE = (process.env.NEXT_PUBLIC_NOTIFY_API_BASE ?? "").replace(
  /\/$/,
  ""
);
const API_KEY = process.env.NEXT_PUBLIC_NOTIFY_API_KEY ?? "";
export const BOT_NAME =
  process.env.NEXT_PUBLIC_LAVANDA_BOT_NAME ?? "lavanda_oblik_bot";

function configured(): boolean {
  return API_BASE !== "" && API_KEY !== "";
}

async function apiFetch(
  path: string,
  data: Record<string, unknown>
): Promise<Response | null> {
  if (!configured()) return null;
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.warn("[telegram] network error", e);
    return null;
  }
}

// ── settings/telegram (admin chatId + per-event flags) ───────────────────

const SETTINGS_DOC = "telegram";

export async function getTelegramSettings(): Promise<TelegramSettings | null> {
  try {
    const snap = await getDoc(doc(firebase.db, "settings", SETTINGS_DOC));
    if (!snap.exists()) return null;
    return snap.data() as TelegramSettings;
  } catch (e) {
    console.warn("[telegram] settings read failed", e);
    return null;
  }
}

export async function saveTelegramSettings(
  patch: Partial<TelegramSettings>
): Promise<void> {
  await setDoc(
    doc(firebase.db, "settings", SETTINGS_DOC),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ── Outbound notifications ───────────────────────────────────────────────

export type NewOrderPayload = {
  orderId: string;
  customerName: string | null;
  createdByName: string | null;
  totalAmount: number;
  itemsCount: number;
  firstItem: string | null;
  deadline: string | null;
};

/**
 * Alert admins that a new user signed up and is waiting for role approval.
 * Server filters: settings/telegram.chatId (якщо notifyNewUser=true) +
 * усі admin'и з telegramChatId, окрім самого новачка.
 */
export async function notifyNewUser(user: {
  uid: string;
  name: string | null;
  email: string;
}): Promise<void> {
  if (!configured()) return;
  await apiFetch("/lavanda/telegram/new-user", {
    uid: user.uid,
    name: user.name ?? "",
    email: user.email,
  });
}

/**
 * Alert linked admins about a freshly created order. Server filters: усі
 * admin-користувачі з заповненим telegramChatId. Перевіряємо settings.notifyNewOrder
 * на клієнті, щоб уникнути зайвої роботи бекенду коли вимкнено.
 */
export async function notifyNewOrder(payload: NewOrderPayload): Promise<void> {
  if (!configured()) return;
  const settings = await getTelegramSettings();
  if (settings && settings.notifyNewOrder === false) return;
  await apiFetch("/lavanda/telegram/new-order", {
    orderId: payload.orderId,
    customerName: payload.customerName ?? "",
    createdByName: payload.createdByName ?? "",
    totalAmount: payload.totalAmount,
    itemsCount: payload.itemsCount,
    firstItem: payload.firstItem ?? "",
    deadline: payload.deadline ?? "",
  });
}

/**
 * Smoke-test "send me a message" з UI налаштувань. Повертає {ok, error?},
 * щоб UI міг показати toast результат.
 */
export async function sendTestTelegram(
  chatId: string,
  name: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!configured()) {
    return { ok: false, error: "Telegram API не налаштовано" };
  }
  const res = await apiFetch("/lavanda/telegram/test", {
    chat_id: chatId,
    name: name ?? "",
  });
  if (!res) return { ok: false, error: "Не вдалося звернутися до сервісу" };
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  try {
    const data = (await res.json()) as { ok: boolean; description?: string };
    return data.ok ? { ok: true } : { ok: false, error: data.description };
  } catch {
    return { ok: false, error: "Не вдалося прочитати відповідь" };
  }
}

// ── Deep-link helpers ────────────────────────────────────────────────────

export function botDeepLink(uid: string): string {
  return `https://t.me/${BOT_NAME}?start=${encodeURIComponent(uid)}`;
}
