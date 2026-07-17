"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone, Send, Users2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listTelegramRecipients,
  type TelegramRecipient,
} from "@/lib/data/users";
import { broadcastNews } from "@/lib/notify/telegram";

/** Шаблон новин за замовчуванням — адмін редагує перед відправкою. */
const DEFAULT_NEWS = `🆕 Оновлення ЛавандаОблік

📸 Запис на фотосесію
• Клієнта тепер можна вибрати або створити прямо у формі
• Почніть вводити ім'я: якщо клієнт є — знайдеться в списку; якщо нема — кнопка «Створити» додасть нового

🔎 Захист від дублів
• Система більше не дасть створити двох однакових клієнтів
• Однакові імена (навіть із зайвими пробілами) розпізнаються автоматично

⬆️ Зручніша навігація
• У довгих списках (клієнти, товари, постачальники) кнопка «Назад», пошук і «Додати» тепер завжди зверху
• Не треба гортати на самий верх, щоб повернутися

✨ Кнопка «Створити» стала помітнішою — виділена кольором навіть у кінці довгого списку

Дякуємо, що з нами! 💜`;

export default function ChangelogBroadcastPage() {
  const { userDoc, loading } = useAuth();
  const isAdmin = userDoc?.role === "admin";

  const [message, setMessage] = useState(DEFAULT_NEWS);
  const [recipients, setRecipients] = useState<TelegramRecipient[] | null>(null);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    listTelegramRecipients()
      .then(setRecipients)
      .catch((e) => {
        console.warn("[changelog] recipients load failed", e);
        setRecipients([]);
      });
  }, [isAdmin]);

  async function handleSendAll() {
    if (!recipients || recipients.length === 0) {
      toast.error("Немає користувачів з підключеним Telegram");
      return;
    }
    if (!message.trim()) {
      toast.error("Повідомлення порожнє");
      return;
    }
    if (
      !window.confirm(
        `Надіслати новини ${recipients.length} ${plural(
          recipients.length,
          "користувачу",
          "користувачам",
          "користувачам"
        )}?`
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const res = await broadcastNews(
        message,
        recipients.map((r) => r.chatId)
      );
      if (res.ok) {
        toast.success(
          res.sent != null
            ? `Надіслано: ${res.sent}${res.failed ? `, помилок: ${res.failed}` : ""}`
            : "Новини надіслано"
        );
      } else {
        toast.error(res.error ?? "Не вдалося надіслати");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSendTest() {
    const myChatId = userDoc?.telegramChatId;
    if (!myChatId) {
      toast.error("Спочатку підключіть Telegram у розділі «Сповіщення»");
      return;
    }
    if (!message.trim()) {
      toast.error("Повідомлення порожнє");
      return;
    }
    setTesting(true);
    try {
      const res = await broadcastNews(message, [String(myChatId)]);
      if (res.ok) {
        toast.success("Тест надіслано вам у Telegram");
      } else {
        toast.error(res.error ?? "Не вдалося надіслати");
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
        <Card>
          <CardContent className="flex items-center gap-3 px-4 py-8 text-sm text-muted-foreground">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
            Розділ доступний лише адміністраторам.
          </CardContent>
        </Card>
      </main>
    );
  }

  const count = recipients?.length ?? null;

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Новини для користувачів
        </h1>
        <p className="text-sm text-muted-foreground">
          Розсилка «що нового» всім, хто підключив Telegram-бота.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 px-4 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-violet-600" />
            <h2 className="text-base font-medium">Текст повідомлення</h2>
          </div>

          <div className="space-y-1">
            <Label htmlFor="news">Повідомлення</Label>
            <Textarea
              id="news"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="font-sans text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Підтримуються емодзі та переноси рядків. Надсилається як звичайний
              текст.
            </p>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users2 className="h-4 w-4" />
            {count == null ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Рахую отримувачів…
              </span>
            ) : (
              <span>
                Отримають{" "}
                <span className="font-medium text-foreground">{count}</span>{" "}
                {plural(count, "користувач", "користувачі", "користувачів")} з
                підключеним Telegram
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSendAll}
              disabled={sending || testing || !count}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Надіслати всім{count ? ` (${count})` : ""}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={sending || testing}
            >
              {testing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Надіслати тест собі
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
