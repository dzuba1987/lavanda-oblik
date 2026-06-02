"use client";

import { useEffect, useState } from "react";

/** Збігається з Tailwind-брейкпоінтом `md` (нижче — мобільний). */
const MOBILE_BREAKPOINT = 768;

/**
 * `true`, якщо ширина viewport менша за `md`. До монтування повертає `false`
 * (SSR/перший рендер), далі реагує на зміну розміру. Застосунок — клієнтський
 * SPA (static export), тож `window` доступний одразу після маунту.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
