"use client";

import { useEffect } from "react";
import { offlineStore } from "@/lib/offline/offline-store";
import { getOfflineKit } from "@/lib/workout/actions";

/** Як часто оновлювати кеш програми при відвідинах дашборда. */
const KIT_MAX_AGE_MS = 10 * 60_000;

/**
 * Дашборд → кеш активної програми на пристрої (дні, вправи, історія для
 * підказок ваги), щоб тренування можна було почати без мережі. Оновлюється
 * не частіше, ніж раз на 10 хв, і одразу після завершеного тренування.
 */
export function OfflineKitSync() {
  useEffect(() => {
    if (!navigator.onLine) return;
    const { kit } = offlineStore.getState();
    const age = kit ? Date.now() - Date.parse(kit.loadedAt) : Infinity;
    if (Number.isFinite(age) && age < KIT_MAX_AGE_MS) return;

    let cancelled = false;
    getOfflineKit()
      .then((next) => {
        if (!cancelled) offlineStore.getState().setKit(next);
      })
      .catch(() => {
        // немає мережі / сесії — лишається попередній кеш
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
