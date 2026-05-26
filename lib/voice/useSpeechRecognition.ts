"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechStatus = "idle" | "listening" | "error" | "unsupported";

export type UseSpeechRecognitionResult = {
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Накопичений фіналізований текст (без поточної фрази в обробці). */
  transcript: string;
  /** Тимчасовий live-результат поточної фрази (interim), очищається при isFinal. */
  interim: string;
  status: SpeechStatus;
  error: string | null;
  supported: boolean;
};

// Web Speech API: типи vendor-prefixed і неповні в lib.dom — оголошуємо мінімум.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
  message?: string;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Тонка обгортка над Web Speech API. Континуальне розпізнавання з
 * interim-результатами для live-прев'ю того, що чує мікрофон.
 *
 * Особливості:
 * - browser support перевіряється у useEffect (window === undefined у SSR).
 * - finalізований текст конкатенується в `transcript`; `interim` показує
 *   поточну необробенну фразу (живий текст під час говоріння).
 * - `start()` повністю переcтворює інстанс — щоб скинути попередній стейт.
 */
export function useSpeechRecognition(
  lang = "uk-UA"
): UseSpeechRecognitionResult {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setStatus("unsupported");
    }
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // інстанс міг бути вже зупиненим — ігноруємо
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setStatus("unsupported");
      return;
    }
    setError(null);
    setTranscript("");
    setInterim("");

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalChunk += text;
        } else {
          interimChunk += text;
        }
      }
      if (finalChunk) {
        setTranscript((prev) =>
          (prev ? prev + " " : "") + finalChunk.trim()
        );
      }
      setInterim(interimChunk);
    };

    recognition.onerror = (e) => {
      setError(e.error || e.message || "unknown");
      setStatus("error");
    };

    recognition.onend = () => {
      setStatus("idle");
      setInterim("");
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setStatus("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалось запустити");
      setStatus("error");
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // якщо вже зупинений — ігноруємо
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return {
    start,
    stop,
    reset,
    transcript,
    interim,
    status,
    error,
    supported,
  };
}
