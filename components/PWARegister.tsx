"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function PWARegister() {
  const [, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        setRegistration(reg);

        // Перевірка оновлень кожні 60 хв
        const interval = setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);

        // Сповістити користувача про нову версію
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              toast(
                "Доступна нова версія додатка",
                {
                  description: "Перезавантажте сторінку, щоб оновитись",
                  action: {
                    label: "Оновити",
                    onClick: () => {
                      newWorker.postMessage("SKIP_WAITING");
                      window.location.reload();
                    },
                  },
                  duration: 30_000,
                }
              );
            }
          });
        });

        // Reload при зміні контролера (новий SW активувався)
        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });

        return () => clearInterval(interval);
      } catch (e) {
        console.warn("Service Worker registration failed", e);
      }
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }
  }, []);

  return null;
}
