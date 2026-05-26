"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onSnapshot, doc, updateDoc, deleteField } from "firebase/firestore";
import {
  BellRing,
  CheckCircle2,
  Copy,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/AuthContext";
import { firebase } from "@/lib/firebase/client";
import { getUserDoc } from "@/lib/data/users";
import {
  BOT_NAME,
  botDeepLink,
  getTelegramSettings,
  saveTelegramSettings,
  sendTestTelegram,
} from "@/lib/notify/telegram";
import type { TelegramSettings, UserDoc } from "@/lib/data/types";

export default function NotificationsSettingsPage() {
  const { authUser, userDoc, loading } = useAuth();
  const isAdmin = userDoc?.role === "admin";

  const [chatId, setChatId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [manualChatId, setManualChatId] = useState("");

  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live listener на власний user doc — як тільки бот пише telegramChatId,
  // тут спрацьовує. Те саме що modules/telegram.js в investment-calculator.
  useEffect(() => {
    if (!authUser) return;
    const unsub = onSnapshot(
      doc(firebase.db, "users", authUser.uid),
      (snap) => {
        const data = snap.data() as UserDoc | undefined;
        const next = data?.telegramChatId ?? null;
        setChatId(next ?? null);
        if (next && waiting) {
          setWaiting(false);
          if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
          toast.success("Telegram підключено");
        }
      },
      (err) => console.warn("[notifications] user snapshot failed", err)
    );
    return () => unsub();
  }, [authUser, waiting]);

  useEffect(() => {
    if (!isAdmin) return;
    getTelegramSettings().then((s) => setSettings(s));
  }, [isAdmin]);

  // Initial load — якщо AuthContext не оновив userDoc, прочитаємо безпосередньо
  useEffect(() => {
    if (!authUser) return;
    getUserDoc(authUser.uid).then((u) => {
      if (u?.telegramChatId) setChatId(u.telegramChatId);
    });
  }, [authUser]);

  const startWaiting = useCallback(() => {
    setWaiting(true);
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    waitTimerRef.current = setTimeout(() => setWaiting(false), 5 * 60 * 1000);
  }, []);

  useEffect(
    () => () => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    },
    []
  );

  async function handleManualSave() {
    if (!authUser) return;
    const id = manualChatId.trim();
    if (!/^-?\d{3,20}$/.test(id)) {
      toast.error("Chat ID — це число (наприклад, 123456789)");
      return;
    }
    try {
      await updateDoc(doc(firebase.db, "users", authUser.uid), {
        telegramChatId: id,
      });
      setChatId(id);
      setManualChatId("");
      toast.success("Chat ID збережено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Не вдалось зберегти");
    }
  }

  async function handleDisconnect() {
    if (!authUser) return;
    if (!window.confirm("Відключити Telegram-сповіщення?")) return;
    try {
      await updateDoc(doc(firebase.db, "users", authUser.uid), {
        telegramChatId: deleteField(),
      });
      setChatId(null);
      toast.success("Telegram відключено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Не вдалось відключити");
    }
  }

  async function handleSendTest() {
    if (!chatId) return;
    setTesting(true);
    try {
      const res = await sendTestTelegram(
        chatId,
        userDoc?.name ?? authUser?.displayName ?? null
      );
      if (res.ok) {
        toast.success("Тестове повідомлення надіслано");
      } else {
        toast.error(res.error ?? "Не вдалося надіслати");
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSettings(patch: Partial<TelegramSettings>) {
    setSavingSettings(true);
    try {
      await saveTelegramSettings(patch);
      setSettings((prev) => ({ ...(prev ?? defaultSettings()), ...patch }));
      toast.success("Налаштування збережено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Не вдалось зберегти налаштування");
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </main>
    );
  }

  if (!authUser) return null;

  const deepLink = botDeepLink(authUser.uid);

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Сповіщення</h1>
        <p className="text-sm text-muted-foreground">
          Підключіть Telegram, щоб отримувати повідомлення про нові замовлення
          та користувачів.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 px-4 py-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-violet-600" />
            <h2 className="text-base font-medium">Telegram-бот @{BOT_NAME}</h2>
          </div>

          {chatId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Підключено · Chat ID:{" "}
                  <code className="font-mono">{chatId}</code>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  Тестове повідомлення
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDisconnect}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Відключити
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Натисніть кнопку нижче — відкриється Telegram, нажміть «Старт».
                Чат прив&apos;яжеться автоматично.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-[#229ed9] hover:bg-[#1d8bc1]"
                >
                  <a
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={startWaiting}
                  >
                    <Send className="mr-1 h-4 w-4" />
                    Підключити Telegram
                  </a>
                </Button>
                {waiting && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Очікую підтвердження з бота…
                  </span>
                )}
              </div>

              <Separator />

              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Або вручну: Chat ID
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Напишіть{" "}
                    <a
                      href={`https://t.me/${BOT_NAME}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 underline"
                    >
                      @{BOT_NAME}
                    </a>{" "}
                    команду <code>/myid</code> і вставте отриманий ID.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="123456789"
                      value={manualChatId}
                      onChange={(e) => setManualChatId(e.target.value)}
                      className="font-mono"
                    />
                    <Button size="sm" onClick={handleManualSave}>
                      Зберегти
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardContent className="space-y-4 px-4 py-4">
            <div>
              <h2 className="text-base font-medium">Налаштування для адмінів</h2>
              <p className="text-xs text-muted-foreground">
                Спільні для всіх адмінів. Прапорці контролюють, які події
                взагалі генерують повідомлення.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <ToggleRow
                checked={settings?.notifyNewUser ?? true}
                disabled={savingSettings}
                label="🆕 Новий користувач очікує підтвердження"
                onChange={(v) => handleSaveSettings({ notifyNewUser: v })}
              />
              <ToggleRow
                checked={settings?.notifyNewOrder ?? true}
                disabled={savingSettings}
                label="🛒 Нове замовлення створено"
                onChange={(v) => handleSaveSettings({ notifyNewOrder: v })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="adminChatId" className="text-sm">
                Резервний Chat ID (опційно)
              </Label>
              <p className="text-xs text-muted-foreground">
                Якщо адмінів небагато або хочеться продублювати сповіщення в
                окремий чат — вкажіть тут. Інакше повідомлення йдуть лише
                адмінам з прив&apos;язаним Telegram.
              </p>
              <div className="flex gap-2">
                <Input
                  id="adminChatId"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456789"
                  defaultValue={settings?.chatId ?? ""}
                  onBlur={(e) =>
                    handleSaveSettings({ chatId: e.target.value.trim() })
                  }
                  className="font-mono"
                />
                {settings?.chatId && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(settings.chatId);
                      toast.success("Скопійовано");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function defaultSettings(): TelegramSettings {
  return { chatId: "", notifyNewUser: true, notifyNewOrder: true };
}

function ToggleRow({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-accent">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-violet-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
