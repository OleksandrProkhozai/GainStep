"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "./install-prompt";

/** Раз за сесію просимо SW оновити офлайн-сторінку (мова, нова збірка). */
const OFFLINE_REFRESH_FLAG = "gainstep-offline-page-refreshed";

/**
 * Реєстрація service worker (лише production-збірка: public/sw.js
 * генерується в `npm run build`). У development SW не потрібен — і
 * лишки від production-збірки на тому ж origin знімаються, щоб кеш
 * не заважав розробці.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    captureInstallPrompt();
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()));
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        try {
          if (!navigator.onLine || sessionStorage.getItem(OFFLINE_REFRESH_FLAG)) return;
          sessionStorage.setItem(OFFLINE_REFRESH_FLAG, "1");
        } catch {
          // sessionStorage недоступний — просто оновлюємо
        }
        registration.active?.postMessage({ type: "CACHE_OFFLINE_PAGE" });
      })
      .catch((error) => console.error("service worker registration failed", error));
  }, []);
  return null;
}
