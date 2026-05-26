"use client";

import { useEffect } from "react";

/**
 * Знімає глобальний boot-loader, який живе на body::before/after через CSS у
 * globals.css. До mount React'а body не має класу .app-ready і користувач
 * бачить спінер — це покриває cold start на повільному інтернеті, поки
 * завантажується bundle.js, парситься HTML і йде hydration.
 */
export function BootLoader() {
  useEffect(() => {
    document.body.classList.add("app-ready");
  }, []);
  return null;
}
