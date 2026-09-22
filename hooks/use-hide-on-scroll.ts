"use client";

import { useEffect, useRef, useState } from "react";

/**
 * true, поки користувач гортає вниз; false — щойно він гортає вгору.
 *
 * Використовує нижня навігація і плаваюча кнопка «+». FAB інакше висить
 * над правим краєм списку і закриває суму останнього видимого рядка —
 * саме ту цифру, заради якої в цей список і дивляться.
 */
export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY.current + 6 && y > 80) setHidden(true);
      else if (y < lastY.current - 6) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
