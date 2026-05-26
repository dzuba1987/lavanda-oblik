"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSpeechRecognition } from "@/lib/voice/useSpeechRecognition";
import { parseOrderTranscript } from "@/lib/ai/parseOrder";
import type { ParsedOrder } from "@/lib/ai/types";
import type { Category, Customer, Product } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export type VoiceOrderButtonProps = {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  /**
   * Викликається з результатом AI-парсингу. Хост-сторінка має відкрити
   * OrderForm з aiDraft={result}.
   */
  onParsed: (result: ParsedOrder) => void;
  className?: string;
};

/**
 * Кнопка-мікрофон для голосового вводу замовлення. Відкриває діалог з live
 * transcription через Web Speech API. AI-парсинг підключається через
 * `onSubmit` — поки що показує toast із транскриптом.
 */
export function VoiceOrderButton({
  categories,
  products,
  customers,
  onParsed,
  className,
}: VoiceOrderButtonProps) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const speech = useSpeechRecognition("uk-UA");

  // Зупиняємо запис при закритті діалогу.
  useEffect(() => {
    if (!open && speech.status === "listening") {
      speech.stop();
    }
  }, [open, speech]);

  const hasTranscript = speech.transcript.trim().length > 0;
  const isListening = speech.status === "listening";

  function handleToggleMic() {
    if (isListening) speech.stop();
    else speech.start();
  }

  async function handleProcess() {
    const text = speech.transcript.trim();
    if (!text || parsing) return;
    setParsing(true);
    try {
      const parsed = await parseOrderTranscript(text, {
        categories,
        products,
        customers,
      });
      if (parsed.items.length === 0) {
        toast.warning("AI не зрозуміла товарів у фразі — спробуй іще раз");
        return;
      }
      onParsed(parsed);
      setOpen(false);
    } catch (e) {
      console.error("parseOrderTranscript failed", e);
      toast.error(
        e instanceof Error ? `Помилка парсингу: ${e.message}` : "Помилка парсингу"
      );
    } finally {
      setParsing(false);
    }
  }

  function handleClose() {
    if (parsing) return;
    speech.stop();
    setOpen(false);
  }

  // Кнопка-тригер: іконка-мікрофон. Прихована якщо браузер не підтримує API.
  if (!speech.supported && speech.status === "unsupported") {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn(className)}
        aria-label="Голосове замовлення"
        title="Створити замовлення голосом"
      >
        <Mic className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Голосове замовлення
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <div className="text-xs text-muted-foreground">
              {speech.status === "listening" && (
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Слухаю… говори українською
                </span>
              )}
              {speech.status === "idle" && !hasTranscript && (
                <span>Натисни мікрофон і продиктуй замовлення</span>
              )}
              {speech.status === "idle" && hasTranscript && (
                <span>Готово. Перевір транскрипт нижче або запиши ще раз.</span>
              )}
              {speech.status === "error" && (
                <span className="text-red-600 dark:text-red-400">
                  Помилка: {speech.error}
                </span>
              )}
            </div>

            {/* Example hint — лише коли ще нічого не записано і не слухаємо */}
            {speech.status === "idle" && !hasTranscript && (
              <div className="rounded-md border border-dashed border-violet-200 bg-violet-50/50 p-2.5 text-xs dark:border-violet-900/40 dark:bg-violet-950/20">
                <div className="mb-1 font-medium text-violet-700 dark:text-violet-300">
                  Приклад:
                </div>
                <div className="italic text-muted-foreground">
                  «Олі — 5 саджанців лаванди по 100 гривень, доставка Новою
                  поштою 50 грн за рахунок клієнта»
                </div>
              </div>
            )}

            {/* Mic button — велика, по центру */}
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={handleToggleMic}
                aria-label={isListening ? "Зупинити запис" : "Почати запис"}
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all",
                  isListening
                    ? "bg-red-500 text-white hover:bg-red-600 ring-4 ring-red-200 dark:ring-red-900/40"
                    : "bg-violet-600 text-white hover:bg-violet-700 hover:scale-105"
                )}
              >
                {isListening ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
            </div>

            {/* Transcript */}
            <div className="min-h-[6rem] rounded-md border bg-muted/40 p-3 text-sm">
              {!hasTranscript && !speech.interim && (
                <span className="text-muted-foreground/60 italic">
                  Тут зʼявиться розпізнаний текст…
                </span>
              )}
              {hasTranscript && (
                <span className="whitespace-pre-wrap">{speech.transcript}</span>
              )}
              {speech.interim && (
                <span className="whitespace-pre-wrap text-muted-foreground italic">
                  {hasTranscript ? " " : ""}
                  {speech.interim}
                </span>
              )}
            </div>

            {hasTranscript && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={speech.reset}
                  className="h-7 px-2 text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  Очистити
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Скасувати
            </Button>
            <Button
              type="button"
              onClick={handleProcess}
              disabled={!hasTranscript || isListening || parsing}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {parsing ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Опрацьовую…
                </>
              ) : isListening ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Запис…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  Опрацювати
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
